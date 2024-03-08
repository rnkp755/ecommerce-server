import asyncHandler from '../utils/asyncHandler.js'
import { APIError } from '../utils/apiError.js'
import { APIResponse } from '../utils/APIResponse.js'
import { Product } from '../models/product.model.js'
import { Order } from '../models/order.model.js'
import { User } from '../models/user.model.js'

const addOrder = asyncHandler(async (req, res, next) => {
      const userId = req.user._id
      if (!userId) throw new APIError(403, 'You are not authorized to access this route')

      const user = await User.findById(userId)
      if (!user) throw new APIError(404, 'Unauthorized access')

      const { product, addressId, orderValue, paymentMode } = req.body

      if (
            [product, addressId, orderValue, paymentMode].includes(undefined) || [product, addressId, orderValue, paymentMode].trim().includes("")
      ) {
            throw new APIError(400, "Please provide all the required fields")
      }

      const productDetails = await Promise.all(
            product.map(async (item) => {
                  if (!item.productId) throw new APIError(400, "Please provide Product Id");

                  const requestedProduct = await Product.findById(item.productId);

                  return requestedProduct && requestedProduct.inStock ? item : null;
            })
      );

      // Filter out products that are not in stock
      const filteredProducts = productDetails.filter(Boolean);

      if (filteredProducts.length === 0) throw new APIError(400, "No products available in stock")


      const newOrder = await Order.create({
            customer: req.user._id,
            product: filteredProducts,
            addressId,
            orderValue,
            paymentMode
      })

      return res
            .status(201)
            .json(new APIResponse(201, newOrder, "Order added successfully"))
})

const fetchOrders = asyncHandler(async (req, res, next) => {
      const userId = req.user._id;
      if (!userId) throw new APIError(403, 'You are not authorized to access this route');

      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', status, paymentMode } = req.query;

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const matchOptions = {
            customer: userId,
      };

      if (status) {
            matchOptions.status = status;
      }

      if (paymentMode) {
            matchOptions.paymentMode = paymentMode;
      }

      const user = await User.findById(userId);
      if (!user) throw new APIError(404, 'Unauthorized access');

      // Admin Previlage
      if (user.role === "admin") {
            const { customerId } = req.body
            if (customerId) {
                  matchOptions.customer = customerId
            }
            else {
                  delete matchOptions.customer
            }
      }

      const orders = await Order.aggregate([
            { $match: matchOptions },
            { $sort: sortOptions },
            { $skip: (page - 1) * limit },
            { $limit: parseInt(limit) },
      ]);

      if (!orders || orders.length === 0) {
            return res
                  .status(200)
                  .json(new APIResponse(200, [], "No orders found for the specified criteria"));
      }

      return res
            .status(200)
            .json(new APIResponse(200, orders, "Orders fetched Successfully"));
});

const fetchOrder = asyncHandler(async (req, res, next) => {
      const userId = req.user._id
      if (!userId) throw new APIError(403, 'You are not authorized to access this route')

      const user = await User.findById(userId)
      if (!user) throw new APIError(404, 'Unauthorized access')

      const { orderId } = req.params
      if (!orderId) throw new APIError(400, "Please provide Order Id")

      // Admin Previlage
      if (user.role === "admin") {
            const order = await Order.findById(orderId)
            if (!order) throw new APIError(404, "Error while fetching order details")
            return res
                  .status(200)
                  .json(new APIResponse(200, order, "Order fetched Successfully"))
      }

      const order = await Order.findById({
            _id: orderId,
            customer: userId
      })
      if (!order) throw new APIError(404, "Error while fetching order details")

      return res
            .status(200)
            .json(new APIResponse(200, order, "Order fetched Successfully"))
})

const cancelOrder = asyncHandler(async (req, res, next) => {
      const userId = req.user._id
      if (!userId) throw new APIError(403, 'You are not authorized to access this route')

      const { orderId } = req.params
      if (!orderId) throw new APIError(400, "Please provide Order Id")

      const user = await User.findById(userId)
      if (!user) throw new APIError(404, 'Unauthorized access')

      // Admin Previlage
      if (user.role === "admin") {
            const order = await Order.findById(orderId)
            if (!order) throw new APIError(404, "Error while fetching order details")
            if (order.status === "Cancelled") throw new APIError(400, "Order already cancelled")

            const updatedOrder = await Order.findByIdAndUpdate(
                  orderId,
                  {
                        status: "Cancelled"
                  },
                  {
                        new: true,
                        runValidators: true
                  }
            )

            return res
                  .status(200)
                  .json(new APIResponse(200, updatedOrder, "Order Cancelled Successfully by Admin"))
      }

      const order = await Order.findById(
            {
                  _id: orderId,
                  customer: userId,
            }

      )
      if (!order) throw new APIError(404, "Error while fetching order details")
      if (order.status === "Cancelled") throw new APIError(400, "Order already cancelled")

      const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            {
                  status: "Cancelled"
            },
            {
                  new: true,
                  runValidators: true
            }
      )

      return res
            .status(200)
            .json(new APIResponse(200, updatedOrder, "Order Cancelled Successfully"))
})

const updateOrderStatus = asyncHandler(async (req, res, next) => {
      if (!req.admin) throw new APIError(403, 'You are not authorized to access this route')

      const { orderId } = req.params
      if (!orderId) throw new APIError(400, "Please provide Order Id")

      const { status } = req.body
      if (!status) throw new APIError(400, "Please provide Order Status")

      const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            {
                  status
            },
            {
                  new: true,
                  runValidators: true
            }
      )
      if (!updatedOrder) throw new APIError(404, "Error while fetching order details")

      return res
            .status(200)
            .json(new APIResponse(200, updatedOrder, "Order Status Updated Successfully by Admin"))

})

export {
      addOrder,
      fetchOrders,
      fetchOrder,
      cancelOrder,
      updateOrderStatus
}