import { Router } from "express";
import {
      addProduct,
      toggleProductStock,
      updateProduct,
      deleteProduct,
      fetchProducts,
      fetchProduct,
      searchProducts,
      rateProduct,
      getRelatedProducts
} from "../controllers/product.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/admin.middleware.js";

const router = Router();

router.route("/add-product").post(
      verifyJWT,
      verifyAdmin,
      upload.fields([
            { name: "productImages", maxCount: 4 },
            { name: "productVideo", maxCount: 1 }
      ]),
      addProduct
);
router.route("/toggle-stock").patch(verifyJWT, verifyAdmin, toggleProductStock);
router.route("/update-product").patch(verifyJWT, verifyAdmin, updateProduct);
router.route("/delete-product").delete(verifyJWT, verifyAdmin, deleteProduct);
router.route("/fetch-products").get(fetchProducts);
router.route("/:productId").get(fetchProduct);
router.route("/search-products").get(searchProducts);
router.route("/rate-product").post(verifyJWT, rateProduct);
router.route("/related-products/:productId").get(getRelatedProducts);

export default router;