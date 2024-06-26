import asyncHandler from '../utils/asyncHandler.js'
import { APIError } from '../utils/apiError.js'
import { APIResponse } from '../utils/APIResponse.js'
import { uploadOnCloudinary } from '../utils/Cloudinary.js'
import { User } from '../models/user.model.js'
import { Product } from '../models/product.model.js'
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async (userId) => {
      try {
            const user = await User.findById(userId)
            const accessToken = await user.generateAccessToken()
            const refreshToken = await user.generateRefreshToken()

            user.refreshToken = refreshToken
            await user.save({ validateBeforeSave: false })

            return { accessToken, refreshToken }

      } catch (error) {
            throw new APIError(500, "Something went wrong while generating Tokens")
      }
}

export const updateMembershipStatus = async (userId) => {
      if (!userId) throw new APIError(400, "User Id is required");

      try {
            const user = await User.findByIdAndUpdate(
                  userId,
                  {
                        $set: {
                              membershipStatus: {
                                    $cond: {
                                          if: { $gte: ["$totalSpent", 15000] },
                                          then: "Platinum",
                                          else: {
                                                $cond: {
                                                      if: { $gte: ["$totalSpent", 5000] },
                                                      then: "Gold",
                                                      else: "Silver"
                                                }
                                          }
                                    }
                              }
                        }
                  },
                  {
                        new: true
                  }
            );

            return user;
      } catch (error) {
            throw new APIError(500, "Something went wrong while updating Membership Status");
      }
};

export const calculateCartTotal = async (userId, affilatedBy) => {
      try {
            const user = await User.findById(userId);

            if (!user) throw new APIError(500, "Error while fetching Cart Details");

            const cart = user.cart;
            let amounts = {
                  totalAmount: 0,
                  discount: 0,
                  payableAmount: 0
            };

            for (const item of cart) {
                  const product = await Product.findById(item.productId);
                  if (!product) {
                        throw new APIError(404, "Product not found in the database");
                  } else if (product.inStock) {
                        const itemTotal = item.quantity * product.price;
                        amounts['totalAmount'] += itemTotal;
                  }
            }

            if (affilatedBy) {
                  amounts.discount = Math.floor(amounts.totalAmount * 0.1);
                  amounts.payableAmount = amounts.totalAmount - amounts.discount;
            } else {
                  amounts.payableAmount = amounts.totalAmount;
            }

            if (user.walletBalance > 0) {
                  const extraDiscount = Math.floor(Math.min(user.walletBalance, amounts.totalAmount * 0.1));
                  amounts.discount += extraDiscount;
                  amounts.payableAmount -= extraDiscount;
            }

            return amounts;
      } catch (error) {
            throw new APIError(500, "Error while calculating Cart Total");
      }
};

const registerUser = asyncHandler(async (req, res) => {
      const { username, email, fullName, password, phone } = req.body;

      if (
            [username, email, fullName, password, phone].includes(undefined) ||
            [username, email, fullName, password, phone].some((field) => !field || field.trim() === "")
      ) {
            throw new APIError(400, "Please provide all the required fields");
      }


      const existedUser = await User.findOne({
            $or: [
                  { username },
                  { email }
            ]
      })
      if (existedUser) {
            throw new APIError(400, "User already exists")
      }

      const user = await User.create({
            username: username.toLowerCase(),
            email,
            fullName,
            password,
            phone
      })

      const newUser = await User.findById(user._id).select(
            "-password -address -walletBalance -wishlist -cart -membershipStatus -affilateCode -totalSpent -role -refreshToken -__v -createdAt -updatedAt"
      )

      if (!newUser) throw new APIError(500, "Something went wrong while creating user")

      return res.status(201).json(new APIResponse(201, newUser, "User Registered Successfully"))

})

const loginUser = asyncHandler(async (req, res) => {
      const { username, email, password } = req.body
      console.log("Username", req.body);

      if (!username && !email) {
            throw new APIError(400, "Email or username is required")
      }

      if (password === undefined || password === "") {
            throw new APIError(400, "Password is required")
      }

      const user = await User.findOne({
            $or: [
                  { username },
                  { email }
            ]
      })

      if (!user) throw new APIError(404, "User doesn't exist")

      const isPasswordValid = await user.isPasswordcorrect(password)

      if (!isPasswordValid) throw new APIError(401, "Invalid User Credentials")

      const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

      user.refreshToken = refreshToken

      const loggedInUser = user.toObject()
      delete loggedInUser['_id']
      delete loggedInUser['password']
      delete loggedInUser['createdAt']
      delete loggedInUser['updatedAt']
      delete loggedInUser['__v']
      delete loggedInUser['role']

      console.log(loggedInUser);

      const options = {
            httpOnly: true,
            secure: true
      }

      return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                  new APIResponse(
                        200,
                        {
                              loggedInUser
                        },
                        "User logged in successfully"
                  )
            )
})

const logoutUser = asyncHandler(async (req, res) => {
      const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                  $unset: {
                        refreshToken: 1
                  }
            },
            {
                  new: true
            }
      )

      const options = {
            httpOnly: true,
            secure: true
      }

      return res
            .status(200)
            .clearCookie("accessToken", options)
            .clearCookie("refreshToken", options)
            .json(
                  new APIResponse(
                        200,
                        {},
                        "User logged out successfully"
                  )
            )
})

const refreshAccessToken = asyncHandler(async (req, res) => {
      const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

      if (!incomingRefreshToken) throw new APIError(401, "Unathorized Access")

      const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
      )

      if (!decodedToken || !decodedToken['_id']) throw new APIError(401, "Unathorized Access")

      const user = await User.findById(decodedToken._id)

      if (!user) throw new APIError(401, "Invalid refresh token")

      if (incomingRefreshToken !== user?.refreshToken) throw new APIError(401, "Refesh Token Invalid or Expired")

      try {
            const tokens = await generateAccessAndRefreshTokens(user._id)
            console.log("New Access Token", tokens.accessToken);

            const options = {
                  httpOnly: true,
                  secure: true
            }

            return res
                  .status(200)
                  .cookie("accessToken", tokens.accessToken, options)
                  .cookie("refreshToken", tokens.refreshToken, options)
                  .json(
                        new APIResponse(
                              200,
                              {
                                    username: user.username,
                                    email: user.email,
                                    fullName: user.fullName,
                                    avatar: user.avatar,
                                    address: user.address,
                                    walletBalance: user.walletBalance,
                                    wishlist: user.wishlist,
                                    cart: user.cart,
                                    membershipStatus: user.membershipStatus,
                                    affilateCode: user.affilateCode,
                                    accessToken: tokens.accessToken,
                                    refreshToken: tokens.refreshToken
                              },
                              "Session restored Successfully"
                        )
                  )
      } catch (error) {
            throw new APIError(501, error?.message || "Error while restarting session")
      }
})

const changeUserPassword = asyncHandler(async (req, res) => {
      const { oldPassword, newPassword } = req.body;
      console.log("Change Password", req.user._id);
      const user = await User.findById(req.user?._id)
      if (!user.isPasswordcorrect(oldPassword)) throw new APIError(400, "Old Password is incorrect")

      user.password = newPassword;
      await user.save({ validateBeforeSave: true })

      return res
            .status(200)
            .json(new APIResponse(200, {}, "Password Updated Successfully"))

})

const updateUserAvatar = asyncHandler(async (req, res) => {
      const avatarLocalPath = req.file?.path;

      if (!avatarLocalPath) throw new APIError(401, "Avatar file not found")

      const avatar = await uploadOnCloudinary(avatarLocalPath)

      if (!avatar?.url) throw new APIError(500, "Error while uploading Avatar on Database")

      const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                  $set: {
                        avatar: avatar.url
                  }
            },
            {
                  new: true
            }
      ).select(
            "-password -totalSpent -role -refreshToken -__v -createdAt -updatedAt"
      )

      return res
            .status(200)
            .json(new APIResponse(
                  200,
                  { user },
                  "Avatar updated Successfully"
            ))
})

const getMyProfile = asyncHandler(async (req, res) => {
      const userId = req.user?._id

      if (!userId) throw new APIError(404, "User doesn't exist")

      const user = await User.aggregate([
            {
                  $match: {
                        _id: userId
                  }
            },
            {
                  $lookup: {
                        from: "orders",
                        localField: "_id",
                        foreignField: "customer",
                        as: "myOrders"
                  }
            },
            {
                  $addFields: {
                        myOrders: "$myOrders",
                        ordersCount: {
                              $size: "$myOrders"
                        }
                  }
            },
            {
                  $project: {
                        fullName: 1,
                        username: 1,
                        email: 1,
                        phone: 1,
                        address: 1,
                        walletBalance: 1,
                        wishlist: 1,
                        cart: 1,
                        membershipStatus: 1,
                        affilateCode: 1,
                        avatar: 1,
                        myOrders: 1,
                        ordersCount: 1
                  }
            }
      ])

      if (!user?.length) throw new APIError(404, "User doesn't exist")

      return res
            .status(200)
            .json(new APIResponse(200, user[0], "User Profile fetched Successfully"))
})

const registerForAffilate = asyncHandler(async (req, res) => {
      const userId = req.user?._id;
      if (!userId) throw new APIError(401, "Unauthorized Access")

      const user = await User.findById(userId)
      if (!user) throw new APIError(401, "User doesn't exist")

      if (user.affilateCode) {
            return res
                  .status(200)
                  .json(new APIResponse(200, user.affilateCode, "Already Registered for Affilate"))
      }

      const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                  $set: {
                        affilateCode: user.username + userId.toString().slice(-4)
                  }
            },
            {
                  new: true
            }
      ).select(
            "-password -walletBalance -wishlist -cart -membershipStatus -refreshToken -__v -createdAt -updatedAt"
      )


      return res
            .status(200)
            .json(new APIResponse(200, updatedUser, "Registered for Affilate Successfully"))
})

const addToWishlist = asyncHandler(async (req, res) => {
      const userId = req.user?._id;
      if (!userId.trim()) throw new APIError(401, "Unauthorized Access")

      const { productId } = req.body
      if (!productId.trim()) throw new APIError(400, "Product Id is required")

      const user = await User.findByIdAndUpdate(
            userId,
            {
                  $push: {
                        wishlist: productId
                  }
            },
            {
                  new: true
            }
      ).select(
            "-password -walletBalance -cart -membershipStatus -affilateCode -totalSpent -role -refreshToken -__v -createdAt -updatedAt"
      )

      if (!user) throw new APIError(500, "Error while adding to Wishlist")

      return res
            .status(200)
            .json(new APIResponse(200, user.wishlist, "Product added to Wishlist Successfully"))
})

const removeFromWishlist = asyncHandler(async (req, res) => {
      const userId = req.user?._id;
      if (!userId.trim()) throw new APIError(401, "Unauthorized Access")

      const { productId } = req.body
      if (!productId.trim()) throw new APIError(400, "Product Id is required")

      const user = await User.findByIdAndUpdate(
            userId,
            {
                  $pull: {
                        wishlist: productId
                  }
            },
            {
                  new: true
            }
      ).select(
            "-password -walletBalance -cart -membershipStatus -affilateCode -totalSpent -role -refreshToken -__v -createdAt -updatedAt"
      )

      if (!user) throw new APIError(500, "Error while removing from Wishlist")

      return res
            .status(200)
            .json(new APIResponse(200, user.wishlist, "Product removed from Wishlist Successfully"))
})

const addToCart = asyncHandler(async (req, res) => {
      const userId = req.user?._id;
      if (!userId) throw new APIError(401, "Unauthorized Access")

      const { productId, quantity, size } = req.body
      if (!productId) throw new APIError(400, "Product Id is required")

      const user = await User.findByIdAndUpdate(
            userId,
            {
                  $push: {
                        cart: {
                              productId,
                              quantity: quantity || 1,
                              size: size || ""
                        }
                  }
            },
            {
                  new: true
            }
      ).select(
            "-password -walletBalance -wishlist -membershipStatus -affilateCode -totalSpent -role -refreshToken -__v -createdAt -updatedAt"
      )

      if (!user) throw new APIError(500, "Error while adding to Cart")

      return res
            .status(200)
            .json(new APIResponse(200, user.cart, "Product added to Cart Successfully"))
})

const viewCart = asyncHandler(async (req, res) => {
      const userId = req.user?._id;
      if (!userId) throw new APIError(401, "Unauthorized Access")

      const userCart = await User.findById(userId).select("cart")
      if (!userCart) throw new APIError(500, "Error while fetching Cart")

      return res
            .status(200)
            .json(new APIResponse(200, userCart.cart, "Cart fetched Successfully"))
})

const removeFromCart = asyncHandler(async (req, res) => {
      const userId = req.user?._id;
      if (!userId.trim()) throw new APIError(401, "Unauthorized Access")

      const { productId } = req.body
      if (!productId.trim()) throw new APIError(400, "Product Id is required")

      const user = await User.findByIdAndUpdate(
            userId,
            {
                  $pull: {
                        cart: {
                              productId
                        }
                  }
            },
            {
                  new: true
            }
      ).select(
            "-password -walletBalance -wishlist -membershipStatus -affilateCode -totalSpent -role -refreshToken -__v -createdAt -updatedAt"
      )

      if (!user) throw new APIError(500, "Error while removing from Cart")

      return res
            .status(200)
            .json(new APIResponse(200, user.cart, "Product removed from Cart Successfully"))
})

const updateCart = asyncHandler(async (req, res) => {
      const userId = req.user?._id;
      if (!userId.trim()) throw new APIError(401, "Unauthorized Access")

      const { productId, quantity, size } = req.body
      if (!productId.trim()) throw new APIError(400, "Product Id is required")

      const user = await User.findOneAndUpdate(
            {
                  _id: userId,
                  "cart.productId": productId
            },
            {
                  $set: {
                        "cart.$.quantity": quantity || 1,
                        "cart.$.size": size || ""
                  }
            },
            {
                  new: true
            }
      ).select(
            "-password -walletBalance -wishlist -membershipStatus -affilateCode -totalSpent -role -refreshToken -__v -createdAt -updatedAt"
      )

      if (!user) throw new APIError(500, "Error while updating Cart")

      return res
            .status(200)
            .json(new APIResponse(200, user.cart, "Cart updated Successfully"))
})

const calculateCartValue = asyncHandler(async (req, res) => {
      const userId = req.user?._id;
      if (!userId) throw new APIError(401, "Unauthorized Access")

      const { affilateCode } = req.body;
      const affilatedBy = affilateCode && (await User.findOne({ affilateCode }));

      const amounts = await calculateCartTotal(userId, affilatedBy?._id || null);
      if (!amounts) throw new APIError(500, "Error while calculating Cart Total")

      const options = {
            httpOnly: true,
            secure: true,
            maxAge: 3600000
      }

      return res
            .status(200)
            .cookie("affilatedBy", affilatedBy?._id || null, options)
            .json(new APIResponse(200, amounts, "Cart Total Calculated Successfully"))
})
const getUserDetails = asyncHandler(async (req, res) => {
      if (!req.admin) throw new APIError(401, "Unauthorized access")

      const { userIdentity } = req.body;
      if (!userIdentity || !userIdentity.trim()) throw new APIError(400, "User Identity is required")

      let user;
      if (userIdentity.trim().match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            user = await User.findOne({ email: userIdentity.toLowerCase() }).select(
                  "-password -cart -wishlist -refreshToken -__v -createdAt -updatedAt"
            )
            if (!user) throw new APIError(404, "User doesn't exist")
      }
      else if (userIdentity.trim().match(/^[0-9]{10}$/)) {
            user = await User.findOne({ phone: userIdentity.trim() }).select(
                  "-password -cart -wishlist -refreshToken -__v -createdAt -updatedAt"
            )
            if (!user) throw new APIError(404, "User doesn't exist")
      }
      else {
            user = await User.findOne({ username: userIdentity.toLowerCase() }).select(
                  "-password -cart -wishlist -refreshToken -__v -createdAt -updatedAt"
            )
            if (!user) throw new APIError(404, "User doesn't exist")
      }

      return res
            .status(200)
            .json(new APIResponse(200, user, "User Data retrieved Successfully"))
})


export {
      registerUser,
      loginUser,
      logoutUser,
      refreshAccessToken,
      changeUserPassword,
      updateUserAvatar,
      getMyProfile,
      registerForAffilate,
      addToWishlist,
      removeFromWishlist,
      addToCart,
      viewCart,
      removeFromCart,
      updateCart,
      calculateCartValue,
      getUserDetails

}