import { Router } from "express";
import {
      addOrder,
      fetchOrders,
      fetchOrder,
      cancelOrder
} from "../controllers/order.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/add-order").post(verifyJWT, addOrder);
router.route("/fetch-orders").get(verifyJWT, fetchOrders);
router.route("/order/:orderId").get(verifyJWT, fetchOrder);
router.route("/cancel-order/:orderId").put(verifyJWT, cancelOrder);

export default router;