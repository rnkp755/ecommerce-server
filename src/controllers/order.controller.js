import asyncHandler from '../utils/asyncHandler.js'
import { APIError } from '../utils/apiError.js'
import { APIResponse } from '../utils/APIResponse.js'
import { Product } from '../models/product.model.js'
import { Order } from '../models/order.model.js'
import { User } from '../models/user.model.js'
import { calculateCartTotal } from './user.controller.js'
import { instance } from "../index.js"
import crypto from 'crypto'
import { Address } from '../models/address.model.js'
import { Affilate } from '../models/affilate.model.js'

const checkout = asyncHandler(async (req, res, next) => {
      const userId = req.user._id
      if (!userId) throw new APIError(403, 'You are not authorized to access this route')

      const user = await User.findById(userId)
      if (!user) throw new APIError(404, 'Unauthorized access')

      const product = user.cart;
      if (!product || product.length === 0) throw new APIError(400, "No products available in cart")

      const { addressId, paymentMode } = req.body

      if (
            [addressId, paymentMode].includes(undefined) ||
            [addressId, paymentMode].some((field) => !field || field.trim() === "")
      ) {
            throw new APIError(400, "Please provide all the required fields");
      }

      const address = await Address.findById(addressId)
      if (!address || !address.user.equals(userId)) throw new APIError(404, "Please provide a valid address")

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

      let affilateByFromCookie = req.cookies?.affilatedBy;
      const affilatedBy = await User.findById(affilateByFromCookie);
      console.log(affilatedBy);

      const amounts = await calculateCartTotal(userId, affilatedBy?._id || null);
      const options = {
            amount: amounts['payableAmount'] * 100,
            currency: "INR",
            receipt: userId.toString() + Date.now().toString(),
            notes: {
                  affilatedBy: affilatedBy?._id || null
            }
      }
      const order = await instance.orders.create(options);

      if (order.error) {
            throw new APIError(400, "Error while creating order", order.error)
      }

      const newOrder = await Order.create({
            customer: userId,
            product: filteredProducts,      // filteredProducts,
            address: addressId,      // addressId,
            orderValue: amounts.payableAmount,
            paymentMode: paymentMode || "Cash on delivery",
            paymentStatus: "Pending",
            razorpay_order_id: order.id,
            affilatedBy: order.notes.affilatedBy
      })

      return res
            .status(201)
            .json(new APIResponse(201, newOrder, "Order added successfully"))

})

const paymentVerification = asyncHandler(async (req, res, next) => {
      const userId = req.user._id
      if (!userId) throw new APIError(403, 'You are not authorized to access this route')

      const user = await User.findById(userId)
      if (!user) throw new APIError(404, 'Unauthorized access')

      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body

      const order = await Order.findOne({ razorpay_order_id });
      order.razorpay_payment_id = razorpay_payment_id;
      order.razorpay_signature = razorpay_signature;
      await order.save({ validateBeforeSave: false });

      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body).digest('hex');
      const isSignatureValid = expectedSignature === razorpay_signature;
      if (!isSignatureValid) throw new APIError(400, "Payment verification failed. Please try again.")

      const updatedOrder = await Order.findByIdAndUpdate(
            order._id,
            {
                  paymentStatus: isSignatureValid ? "Success" : "Failed"
            },
            {
                  new: true,
                  runValidators: true
            }
      )
      if (!updatedOrder) throw new APIError(404, "Error while updating payment status")

      user.cart = [];
      await user.save({ validateBeforeSave: false });

      if (updatedOrder.affilatedBy) {
            const affilateData = await Affilate.create({
                  affilatedFrom: updatedOrder.affilatedBy,
                  affilatedTo: userId,
                  order: updatedOrder._id,
                  reward: updatedOrder.orderValue * 0.01
            })
      }

      return res
            .status(201)
            .json(new APIResponse(201, updatedOrder, "Order added successfully"))
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
            const { customerDetail } = req.body
            if (!customerDetail) delete matchOptions.customer;

            else if (customerDetail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                  const customer = await User.findOne({ email: customerDetail }).select('_id')
                  if (!customer) throw new APIError(404, 'No customer found with the provided email')
                  matchOptions.customer = customer._id
            }
            else if (customerDetail.match(/^[0-9]{10}$/)) {
                  const customer = await User.findOne({ phone: customerDetail }).select('_id')
                  if (!customer) throw new APIError(404, 'No customer found with the provided phone number')
                  matchOptions.customer = customer._id
            }
            else {
                  const customer = await User.findOne({ username: customerDetail.toLowerCase() }).select('_id')
                  if (!customer) throw new APIError(404, 'No customer found with the provided username')
                  matchOptions.customer = customer._id
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

      if (status === "Delivered") {
            const user = await User.findById(updatedOrder.customer)
            // Update wallet balance
            if (user.membershipStatus === "Silver") {
                  user.boundedWalletBalance.push({
                        amount: Math.floor(updatedOrder.orderValue * 0.03)
                  });
            }
            else if (user.membershipStatus === "Silver") {
                  user.boundedWalletBalance.push({
                        amount: Math.floor(updatedOrder.orderValue * 0.06)
                  });
            }
            else {
                  user.boundedWalletBalance.push({
                        amount: Math.floor(updatedOrder.orderValue * 0.09)
                  });
            }
            // Update membership status and total spent of the user
            user.totalSpent = user.totalSpent + updatedOrder.orderValue;
            if (user.totalSpent >= 15000) user.membershipStatus = "Platinum";
            else if (user.totalSpent >= 5000) user.membershipStatus = "Gold";
            await user.save({ validateBeforeSave: false });

            // Give commission to affilate
            const affilate = await Affilate.findOne({ order: orderId });
            if (affilate) {
                  const affilatedBy = await User.findById(affilate.affilatedFrom);
                  user.boundedWalletBalance.push({
                        amount: affilate.reward
                  });
                  await affilatedBy.save({ validateBeforeSave: false });

                  affilate.status = "Credited";
                  await affilate.save({ validateBeforeSave: false });
            }
      }

      return res
            .status(200)
            .json(new APIResponse(200, updatedOrder, "Order Status Updated Successfully by Admin"))

})

export {
      checkout,
      paymentVerification,
      fetchOrders,
      fetchOrder,
      cancelOrder,
      updateOrderStatus
}