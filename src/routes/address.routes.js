import { Router } from "express";
import {
      addNewAddress,
      fetchAddresses,
      updateAddress,
      deleteAddress
} from "../controllers/address.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/add-address").post(verifyJWT, addNewAddress);
router.route("/fetch-addresses").get(verifyJWT, fetchAddresses);
router.route("/update-address/:addressId").patch(verifyJWT, updateAddress);
router.route("/delete-address/:addressId").delete(verifyJWT, deleteAddress);

export default router;