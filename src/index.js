import dotenv from 'dotenv'
import connectToMongo from './db/index.js'
import app from "./app.js"
import Razorpay from 'razorpay'

dotenv.config({
      path: './.env'
})

export var instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
})

connectToMongo()
      .then(() => {
            app.on("error", (error) => {
                  console.log("MongoDB Connection Failed !!");
                  throw error;
            })
            app.listen((process.env.PORT || 8000), () => {
                  console.log(`Server is listening on PORT ${process.env.PORT || 5173}`);
            })
      })
      .catch((error) => {
            console.log("MongoDB Connection Failed !!");
      })