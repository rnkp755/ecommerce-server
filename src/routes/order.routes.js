import { Router } from "express";
import {
      addOrder,
      fetchOrders,
      fetchOrder,
      cancelOrder,
      updateOrderStatus
} from "../controllers/order.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/admin.middleware.js";

const router = Router();

router.route("/add-order").post(verifyJWT, addOrder);
router.route("/fetch-orders").get(verifyJWT, fetchOrders);
router.route("/order/:orderId").get(verifyJWT, fetchOrder);
router.route("/cancel-order/:orderId").post(verifyJWT, cancelOrder);
router.route("/update-order-status/:orderId").post(verifyJWT, verifyAdmin, updateOrderStatus);

export default router;