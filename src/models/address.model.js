import mongoose, { Schema } from "mongoose"

const addressSchema = new Schema({
      user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
      },
      name: {
            type: String,
            required: true,
            trim: true,
            minLength: [3, "Name must be at least 3 characters long"]
      },
      phone: {
            type: String,
            required: true,
            trim: true,
            minLength: [10, "Phone number must be at least 10 characters long"],
            maxLength: [10, "Phone number must be at most 10 characters long"],
            match: [/^[0-9]{10}$/, "Invalid phone number"]
      },
      pincode: {
            type: String,
            required: true,
            trim: true,
            minLength: [6, "Pincode must be at least 6 characters long"],
            maxLength: [6, "Pincode must be at most 6 characters long"],
            match: [/^[0-9]{6}$/, "Invalid pincode"]
      },
      landmark: {
            type: String,
            trim: true,
            minLength: [3, "Locality must be at least 3 characters long"]
      },
      address: {
            type: String,
            required: true,
            trim: true,
            minLength: [10, "Address must be at least 10 characters long"]
      },
      city: {
            type: String,
            required: true,
            trim: true,
            minLength: [3, "City must be at least 3 characters long"]
      },
      state: {
            type: String,
            required: true,
            trim: true,
            minLength: [3, "State must be at least 3 characters long"]
      },
      country: {
            type: String,
            required: true,
            trim: true,
            enum: ["India"],
            defauult: "India"
      }
}, { timestamps: true })