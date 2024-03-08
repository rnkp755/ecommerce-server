import mongoose, { Schema } from "mongoose"
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

const userSchema = new Schema({
      username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
            minLength: [3, "Username must be at least 3 characters long"]
      },
      email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            minLength: [8, "Email must be at least 8 characters long"],
            match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email"]
      },
      phone: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minLength: [10, "Phone number must be at least 10 characters long"],
            maxLength: [10, "Phone number must be at most 10 characters long"],
            match: [/^[0-9]{10}$/, "Invalid phone number"]
      },
      fullName: {
            type: String,
            required: true,
            trim: true,
            minLength: [3, "Name must be at least 3 characters long"]
      },
      avatar: {
            type: String
      },
      password: {
            type: String,
            required: true,
            minLength: [8, "Password must be at least 8 characters long"],
            maxLength: [16, "Password must be at most 16 characters long"]
      },
      address: [
            {
                  type: Schema.Types.ObjectId,
                  ref: "Address"
            }
      ],
      walletBalance: {
            type: Number,
            default: 0
      },
      boundedWalletBalance: [
            {
                  amount: {
                        type: Number,
                        required: true
                  },
                  creditedOn: {
                        type: Date,
                        default: Date.now
                  }
            }
      ],
      wishlist: [
            {
                  type: Schema.Types.ObjectId,
                  ref: "Product"
            }
      ],
      cart: [
            {
                  productId: {
                        type: Schema.Types.ObjectId,
                        ref: "Product"
                  },

                  quantity: {
                        type: Number,
                        default: 1
                  },

                  size: {
                        type: String
                  }
            }
      ],
      membershipStatus: {
            type: String,
            enum: ["Silver", "Gold", "Platinum"],
            default: "Silver"
      },
      affilateCode: {
            type: String
      },
      totalSpent: {
            type: Number,
            default: 0
      },
      role: {
            type: String,
            enum: ["user", "admin"],
            default: "user"
      },
      refreshToken: {
            type: String
      }
}, { timestamps: true })

userSchema.pre("save", async function (next) {
      if (this.isModified("password")) {
            this.password = await bcrypt.hash(this.password, 8)
      }
      next()
})

userSchema.methods.isPasswordcorrect = async function (password) {
      return await bcrypt.compare(password, this.password)
}

userSchema.methods.generateAccessToken = async function () {
      return jwt.sign(
            {
                  _id: this._id,
                  username: this.username,
                  fullName: this.fullName
            },
            process.env.ACCESS_TOKEN_SECRET,
            {
                  expiresIn: process.env.ACCESS_TOKEN_EXPIRY
            }
      )
}

userSchema.methods.generateRefreshToken = async function () {
      return jwt.sign(
            {
                  _id: this._id
            },
            process.env.REFRESH_TOKEN_SECRET,
            {
                  expiresIn: process.env.REFRESH_TOKEN_EXPIRY
            }
      )
}
export const User = mongoose.model('User', userSchema);