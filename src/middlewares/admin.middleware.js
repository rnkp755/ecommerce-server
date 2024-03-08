import { User } from "../models/user.model.js"
import { APIError } from "../utils/apiError.js"

export const verifyAdmin = async (req, res, next) => {
      try {
            const userId = req.user?._id

            const user = await User.findById(userId)
            if (user.role !== "admin") {
                  throw new APIError(401, "Unauthorized access")
            }
            req.admin = true;
            next()
      }
      catch (error) {
            throw new APIError(401, "Couldn't validate admin status")
      }
}