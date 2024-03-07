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

const updateMembershipStatus = async (userId) => {
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

const registerUser = asyncHandler(async (req, res) => {
      const { username, email, fullName, password, phone } = req.body
      if (
            [username, email, fullName, password, phone].includes(undefined) || [username, email, fullName, password, phone].trim().includes("")
      ) {
            throw new APIError(400, "Please provide all the required fields")
      }
      // Other Validations

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
                              user
                        },
                        "User logged in successfully"
                  )
            )
})

const logoutUser = asyncHandler(async (req, res) => {
      console.log("Logout ", req.user._id);
      // Output : Logout  undefined
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
            const { newAccessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id)
            console.log("New Access Token", newAccessToken);

            const options = {
                  httpOnly: true,
                  secure: true
            }

            return res
                  .status(200)
                  .cookie("accessToken", newAccessToken, options)
                  .cookie("refreshToken", newRefreshToken, options)
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
                                    accessToken: newAccessToken,
                                    refreshToken: newRefreshToken
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
      const avatarLocalPath = req.file?.avatar;

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
      const { userId } = req.user._id

      if (!userId?.trim()) throw new APIError(404, "User doesn't exist")

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
                        myOrders,
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
      if (!userId.trim()) throw new APIError(401, "Unauthorized Access")

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
            .json(new APIResponse(200, user, "Registered for Affilate Successfully"))
})

const addNewAddress = asyncHandler(async (req, res) => {
      const userId = req.user?._id;
      if (!userId.trim()) throw new APIError(401, "Unauthorized Access")

      const { name, phone, pincode, landmark, address, city, state, country } = req.body
      if (
            [name, phone, pincode, address, city, state, country].includes(undefined) || [name, phone, pincode, address, city, state, country].trim().includes("")
      ) {
            throw new APIError(400, "Please provide all the required fields")
      }

      const user = await User.findByIdAndUpdate(
            userId,
            {
                  $push: {
                        address: {
                              name,
                              phone,
                              pincode,
                              landmark: landmark || "",
                              address,
                              city,
                              state,
                              country: country || "India"
                        }
                  }
            },
            {
                  new: true
            }
      ).select(
            "-password -walletBalance -wishlist -cart -membershipStatus -affilateCode -totalSpent -role -refreshToken -__v -createdAt -updatedAt"
      )

      if (!user) throw new APIError(500, "Error while adding new Address")

      return res
            .status(200)
            .json(new APIResponse(200, user, "Address added Successfully"))
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
      if (!userId.trim()) throw new APIError(401, "Unauthorized Access")

      const { productId, quantity, size } = req.body
      if (!productId.trim()) throw new APIError(400, "Product Id is required")

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

const calculateCartTotal = asyncHandler(async (req, res) => {
      const userId = req.user?._id;
      if (!userId.trim()) throw new APIError(401, "Unauthorized Access")

      const user = await User.findById(userId).select("cart");

      if (!user) throw new APIError(500, "Error while fetching Cart Details")

      const cart = user.cart;
      let totalAmount = 0;

      for (const item of cart) {
            const product = await Product.findById(item.productId);
            if (!product) {
                  throw new APIError(404, "Product not found in the database");
            }

            const itemTotal = item.quantity * product.price;
            totalAmount += itemTotal;
      }

      return res
            .status(200)
            .json(new APIResponse(200, totalAmount, "Cart Total Calculated Successfully"))
})

const getUserDetails = asyncHandler(async (req, res) => {
      if (!req.admin) throw new APIError(401, "Unauthorized access")

      const { userIdentity } = req.body;
      if (!userIdentity.trim()) throw new APIError(400, "User Identity is required")

      let user;
      if (userIdentity.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            user = await User.findOne({ email: userIdentity.toLowerCase() }).select(
                  "-password -cart -wishlist -refreshToken -__v -createdAt -updatedAt"
            )
            if (!user) throw new APIError(404, "User doesn't exist")
      }
      else if (userIdentity.match(/^[0-9]{10}$/)) {
            user = await User.findOne({ phone }).select(
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
      addNewAddress,
      addToWishlist,
      removeFromWishlist,
      addToCart,
      removeFromCart,
      updateCart,
      calculateCartTotal,
      getUserDetails

}