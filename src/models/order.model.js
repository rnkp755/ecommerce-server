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
      address: {
            type: Schema.Types.ObjectId,
            ref: "Address",
            required: true
      },
      orderValue: {
            type: Number,
            required: true,
            min: [10, "Order Value must be at least 1"]
      },
      paymentMode: {
            type: String,
            enum: ["Cash on delivery", "Online"],
            default: "Cash on delivery"
      },
      paymentStatus: {
            type: String,
            enum: ["Pending", "Success", "Failed"],
            default: "Pending"
      },
      razorpay_payment_id: {
            type: String,
            default: ""
      },
      razorpay_order_id: {
            type: String,
            default: ""
      },
      razorpay_signature: {
            type: String,
            default: ""
      },
      status: {
            type: String,
            enum: ["Pending", "Ordered", "Shipped", "Out for delivery", "Delivered", "Cancelled"],
            default: "Pending"
      },
      affilatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null
      }
}, { timestamps: true })

orderSchema.plugin(mongooseAggregatePaginate);
export const Order = mongoose.model("Order", orderSchema)