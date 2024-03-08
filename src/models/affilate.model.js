import mongoose, { Schema } from "mongoose"

const affilateSchema = new Schema({
      affilatedFrom: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "User"
      },
      affilatedTo: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "User"
      },
      order: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "Order"
      },
      reward: {
            type: Number,
            required: true,
            min: 0
      },
      status: {
            type: String,
            enum: ["Pending", "Credited", "Declined"],
            default: "Pending"
      }
}, { timestamps: true })

export const Affilate = mongoose.model("Affilate", affilateSchema)