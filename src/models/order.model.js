import mongoose, { Schema } from "mongoose"
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2"

const orderSchema = new Schema({
      customer: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
      },
      product: [
            {
                  productId: {
                        type: Schema.Types.ObjectId,
                        ref: "Product",
                        required: true
                  },

                  quantity: {
                        type: Number,
                        required: true,
                        default: 1,
                        min: [1, "Quantity must be at least 1"]
                  },

                  size: {
                        type: String,
                        default: ""
                  }
            }
      ],
      orderValue: {
            type: Number,
            required: true,
            min: [10, "Order Value must be at least 1"]
      },
      status: {
            type: String,
            enum: ["Pending", "Ordered", "Shipped", "Out for delivery", "Delivered", "Cancelled"],
            default: "Pending"
      }
}, { timestamps: true })

orderSchema.plugin(mongooseAggregatePaginate);
export const Order = mongoose.model("Order", orderSchema)