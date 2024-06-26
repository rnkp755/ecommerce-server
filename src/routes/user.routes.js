import { Router } from "express";
import {
      registerUser,
      loginUser,
      logoutUser,
      refreshAccessToken,
      changeUserPassword,
      updateUserAvatar,
      getMyProfile,
      registerForAffilate,
      addToWishlist,
      removeFromWishlist,
      addToCart,
      viewCart,
      removeFromCart,
      updateCart,
      calculateCartValue,
      getUserDetails
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/admin.middleware.js";

const router = Router();

router.route("/register").post(registerUser);
router.route("/login").post(loginUser);
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-access-token").post(refreshAccessToken);
router.route("/change-password").post(verifyJWT, changeUserPassword);
router.route("/update-avatar")
      .patch(
            verifyJWT,
            upload.single("avatar"),
            updateUserAvatar
      )
router.route("/profile").get(verifyJWT, getMyProfile);
router.route("/register-affilate").post(verifyJWT, registerForAffilate);
router.route("/add-to-wishlist").post(verifyJWT, addToWishlist);
router.route("/remove-from-wishlist").post(verifyJWT, removeFromWishlist);
router.route("/add-to-cart").post(verifyJWT, addToCart);
router.route("/view-cart").post(verifyJWT, viewCart);
router.route("/remove-from-cart").post(verifyJWT, removeFromCart);
router.route("/update-cart").post(verifyJWT, updateCart);
router.route("/calculate-cart-value").post(verifyJWT, calculateCartValue);
router.route("/user-details").get(verifyJWT, verifyAdmin, getUserDetails);

export default router;