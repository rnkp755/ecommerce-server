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
}, { timestamps: true })

productSchema.plugin(mongooseAggregatePaginate);
export const Product = mongoose.model("Product", productSchema)