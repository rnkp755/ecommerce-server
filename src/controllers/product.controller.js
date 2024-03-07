import asyncHandler from '../utils/asyncHandler.js'
import { APIError } from '../utils/apiError.js'
import { APIResponse } from '../utils/APIResponse.js'
import { uploadOnCloudinary } from '../utils/Cloudinary.js'
import { User } from '../models/user.model.js'
import { Product } from '../models/product.model.js'

const addProduct = asyncHandler(async (req, res, next) => {
      if (!req.admin) throw new APIError(403, 'You are not authorized to access this route')
      const { name, description, price, category, suitableFor } = req.body

})