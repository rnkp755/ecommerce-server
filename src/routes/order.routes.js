import { Router } from "express";
import {
      checkout,
      paymentVerification,
      getRazorPayKey,
      fetchOrders,
      fetchOrder,
      cancelOrder,
      updateOrderStatus
} from "../controllers/order.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/admin.middleware.js";

const router = Router();

router.route("/checkout").post(verifyJWT, checkout);
router.route("/verify-payment").post(verifyJWT, paymentVerification);
router.route("/razorpay-key").post(verifyJWT, getRazorPayKey);
router.route("/fetch-orders").get(verifyJWT, fetchOrders);
router.route("/order/:orderId").get(verifyJWT, fetchOrder);
router.route("/cancel-order/:orderId").post(verifyJWT, cancelOrder);
router.route("/update-status/:orderId").post(verifyJWT, verifyAdmin, updateOrderStatus);

export default router;