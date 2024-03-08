import asyncHandler from '../utils/asyncHandler.js'
import { APIError } from '../utils/apiError.js'
import { APIResponse } from '../utils/APIResponse.js'
import { uploadOnCloudinary } from '../utils/Cloudinary.js'
import { Product } from '../models/product.model.js'

const addProduct = asyncHandler(async (req, res, next) => {
      if (!req.user || !req.admin) throw new APIError(403, 'You are not authorized to access this route')
      const { name, description, price, category, suitableFor } = req.body

      if (
            [name, description, price, category,].includes(undefined) || [name, description, price, category].trim().includes("")
      ) {
            throw new APIError(400, "Please provide all the required fields")
      }

      if (price < 10) throw new APIError(400, "Price must be at least 10")

      if (!req.files.productImages) throw new APIError(400, "Please provide at least one product image")

      const display = []
      for (const imageLocalPath of req.files.productImages) {
            const image = await uploadOnCloudinary(imageLocalPath)
            if (!image?.url) throw new APIError(500, "Error while uploading Image on Database")
            display.push(image.url)
      }

      if (req.files.productVideo) {
            const video = await uploadOnCloudinary(req.files.productVideo[0])
            if (!video?.url) throw new APIError(500, "Error while uploading Video on Database")
            display.push(video.url)
      }

      const newProduct = new Product({
            name,
            description,
            price,
            category,
            suitableFor: suitableFor || "Unisex",
            display
      })

      return res
            .status(201)
            .json(new APIResponse(201, newProduct, "Product added successfully"))

})

const toggleProductStock = asyncHandler(async (req, res, next) => {
      if (!req.user || !req.admin) throw new APIError(403, 'You are not authorized to access this route')

      const { productId } = req.body;
      if (!productId) throw new APIError(400, "Please provide a product ID")

      const product = await Product.findByIdAndUpdate(
            productId,
            {
                  $set: {
                        inStock: !product.inStock
                  }
            },
            {
                  new: true
            }
      )
      if (!product) throw new APIError(404, "Product not found")

      return res
            .status(200)
            .json(new APIResponse(200, product, "Product stock updated successfully"))
})

const updateProduct = asyncHandler(async (req, res, next) => {
      if (!req.user || !req.admin) throw new APIError(403, 'You are not authorized to access this route')

      const { productId, name, description, price, category, suitableFor } = req.body;
      if (!productId) throw new APIError(400, "Please provide a product ID")

      if (!name && !description && !price && !category && !suitableFor) throw new APIError(400, "Please provide at least one field to update")

      const product = await Product.findByIdAndUpdate(
            productId,
            {
                  $set: {
                        name: name || product.name,
                        description: description || product.description,
                        price: price || product.price,
                        category: category || product.category,
                        suitableFor: suitableFor || product.suitableFor
                  }
            },
            {
                  new: true
            }
      )
      if (!product) throw new APIError(404, "Product not found")

      return res
            .status(200)
            .json(new APIResponse(200, product, "Product updated successfully"))
})

const deleteProduct = asyncHandler(async (req, res, next) => {
      if (!req.user || !req.admin) throw new APIError(403, 'You are not authorized to access this route')

      const { productId } = req.body;
      if (!productId) throw new APIError(400, "Please provide a product ID")

      const product = await Product.findByIdAndDelete(productId)
      if (!product) throw new APIError(404, "Product not found")

      return res
            .status(200)
            .json(new APIResponse(200, product, "Product deleted successfully"))
})

const fetchProducts = asyncHandler(async (req, res, next) => {
      const { page, limit, category, suitableFor, inStock } = req.query
      const query = {}
      if (category) query.category = category
      if (suitableFor) query.suitableFor = suitableFor
      if (inStock) query.inStock = inStock

      const products = await Product.aggregatePaginate(
            Product.aggregate([
                  {
                        $match: query
                  }
            ]),
            {
                  page: page || 1,
                  limit: limit || 10
            }
      )
      return res
            .status(200)
            .json(new APIResponse(200, products, "Products fetched successfully"))
})

const fetchProduct = asyncHandler(async (req, res, next) => {
      const { productId } = req.params
      if (!productId) throw new APIError(400, "Please provide a product ID")

      const product = await Product.findById(productId)
      if (!product) throw new APIError(404, "Product not found")

      return res
            .status(200)
            .json(new APIResponse(200, product, "Product fetched successfully"))
})

const searchProducts = asyncHandler(async (req, res, next) => {
      const { keyword } = req.query;
      if (!keyword) throw new APIError(400, "Please provide a keyword to search")

      const products = await Product.find({
            $or: [
                  { name: { $regex: keyword, $options: 'i' } },
                  { description: { $regex: keyword, $options: 'i' } }
            ]
      })

      return res
            .status(200)
            .json(new APIResponse(200, products, "Products searched successfully"))
})

const rateProduct = asyncHandler(async (req, res, next) => {
      if (!req.user) throw new APIError(403, 'You must be logged in to rate a product')
      const { productId, ratingStar, reviewMsg } = req.body;
      if (!productId || !ratingStar) throw new APIError(400, "Please provide a product ID and rating")

      const product = await Product.findByIdAndUpdate(
            productId,
            {
                  $push: {
                        ratings: {
                              star: ratingStar,
                              review: reviewMsg,
                              user: req.user._id
                        }
                  }
            },
            {
                  new: true
            }
      )
      if (!product) throw new APIError(404, "Product not found")

      return res
            .status(200)
            .json(new APIResponse(200, product, "Product rated successfully"))
})

const getRelatedProducts = asyncHandler(async (req, res, next) => {
      const { productId } = req.params
      if (!productId) throw new APIError(400, "Please provide a product ID")

      const product = await Product.findById(productId)
      if (!product) throw new APIError(404, "Product not found")

      const relatedProducts = await Product.find({
            $and: [
                  { category: product.category },
                  { _id: { $ne: product._id } }
            ]
      }).limit(5)

      return res
            .status(200)
            .json(new APIResponse(200, relatedProducts, "Related products fetched successfully"))
})

export {
      addProduct,
      toggleProductStock,
      updateProduct,
      deleteProduct,
      fetchProducts,
      fetchProduct,
      searchProducts,
      rateProduct,
      getRelatedProducts
}