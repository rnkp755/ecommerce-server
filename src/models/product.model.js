import mongoose, { Schema } from "mongoose"
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2"

const productSchema = new Schema({
      name: {
            type: String,
            required: true,
            trim: true,
      },
      description: {
            type: String,
            required: true,
            minLength: [20, "Description must be at least 20 characters long"]
      },
      price: {
            type: Number,
            required: true,
            min: [10, "Price must be at least 10"]
      },
      category: {
            type: String,
            enum: ["Necklace", "Ear-ring", "Perfume", "Clothes", "Shoes", "Bags", "Watches", "Glasses", "Hats", "Socks", "Others"],
            default: "Others"
      },
      inStock: {
            type: Boolean,
            default: true
      },
      suitableFor: {
            type: String,
            enum: ["Male", "Female", "Unisex"],
            default: "Unisex"
      },
      display: [
            {
                  type: String,
                  required: true
            }
      ],
      ratings: [
            {
                  star: {
                        type: Number,
                        required: true,
                        min: 1,
                        max: 5
                  },
                  review: {
                        type: String,
                        trim: true
                  },
                  user: {
                        type: Schema.Types.ObjectId,
                        ref: "User"
                  }
            }
      ]
}, { timestamps: true })

productSchema.plugin(mongooseAggregatePaginate);
export const Product = mongoose.model("Product", productSchema)