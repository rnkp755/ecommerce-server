import express from "express"
import cookieparser from "cookie-parser"
import cors from "cors"

const app = express();

app.use(cors({
      origin: process.env.CROSS_ORIGIN,
      Credentials: true
}))

app.use(express.json({ limit: "16kb" }))
app.use(express.urlencoded({
      extended: true,
      limit: "16kb"
}))
app.use(express.static("public"))
app.use(cookieparser())


//Routers
import userRouter from "./routes/user.routes.js"
import productRouter from "./routes/product.routes.js"
import addressRouter from "./routes/address.routes.js"
import orderRouter from "./routes/order.routes.js"

app.use('/api/v1/users', userRouter)
app.use('/api/v1/products', productRouter)
app.use('/api/v1/addresses', addressRouter)
app.use('/api/v1/orders', orderRouter)

export default app;