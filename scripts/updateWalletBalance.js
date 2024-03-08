import cron from 'node-cron';
import { User } from '../models/user.model.js';
import connectToMongo from './db/index.js'

let twentyDaysAgo;
const job = cron.schedule('0 0 * * *', async () => {
      try {
            const users = await User.find({
                  'boundedWalletBalance.creditedOn': { $lte: twentyDaysAgo },
            });

            users.forEach(async (user) => {
                  user.boundedWalletBalance.forEach((entry) => {
                        user.walletBalance += entry.amount;
                  });

                  // Remove entries older than 20 days from boundedWalletBalance
                  user.boundedWalletBalance = user.boundedWalletBalance.filter(
                        (entry) => entry.creditedOn > twentyDaysAgo
                  );

                  await user.save();
            });

            console.log('Wallet balance updated successfully.');
      } catch (error) {
            console.error('Error updating wallet balance:', error);
      }
});


connectToMongo()
      .then(() => {
            twentyDaysAgo = new Date();
            twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);

            job.start();
      })
      .catch((error) => {
            console.error('Error connecting to MongoDB:', error);
      });



