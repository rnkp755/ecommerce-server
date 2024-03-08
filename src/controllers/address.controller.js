import asyncHandler from '../utils/asyncHandler.js'
import { APIError } from '../utils/apiError.js'
import { APIResponse } from '../utils/APIResponse.js'
import { User } from '../models/user.model.js'
import { Address } from '../models/address.model.js'

const addNewAddress = asyncHandler(async (req, res) => {
      const userId = req.user?._id;
      if (!userId) throw new APIError(401, "Unauthorized Access")

      const { name, phone, pincode, landmark, address, city, state, country } = req.body
      if (
            [name, phone, pincode, address, city, state].includes(undefined) ||
            [name, phone, pincode, address, city, state].some((field) => !field || field.trim() === "")
      ) {
            throw new APIError(400, "Please provide all the required fields");
      }

      const user = await User.findById(userId)

      if (!user) throw new APIError(500, "Error while adding new Address")

      const newAddress = await Address.create({
            user: userId,
            name,
            phone,
            pincode,
            landmark: landmark || "",
            address,
            city,
            state,
            country: country || "India"
      })

      user.address.push(newAddress._id);
      await user.save({ validateBeforeSave: false });

      return res
            .status(200)
            .json(new APIResponse(200, newAddress, "Address added Successfully"))
})

const fetchAddresses = asyncHandler(async (req, res) => {
      const userId = req.user?._id;
      if (!userId) throw new APIError(401, "Unauthorized Access")

      const addresses = await Address.find({ user: userId })
      if (!addresses) throw new APIError(500, "Error while fetching Addresses")

      return res
            .status(200)
            .json(new APIResponse(200, addresses, "Addresses fetched Successfully"))
})

const updateAddress = asyncHandler(async (req, res) => {
      const userId = req.user?._id;
      if (!userId) throw new APIError(401, "Unauthorized Access");

      const { addressId } = req.params;
      if (!addressId) throw new APIError(400, "Please provide Address Id");

      const { name, phone, pincode, landmark, address, city, state, country } = req.body;
      if (!name && !phone && !pincode && !address && !city && !state && !country) {
            throw new APIError(400, "Please provide at least one field to update");
      }

      // Check if the provided addressId belongs to the user
      const addressToUpdate = await Address.findById(addressId);

      if (!addressToUpdate || !addressToUpdate.user.equals(userId)) {
            throw new APIError(403, "You are not authorized to update this address");
      }

      // Construct the update object with only the fields that are provided
      const updateObject = {};
      if (name) updateObject.name = name;
      if (phone) updateObject.phone = phone;
      if (pincode) updateObject.pincode = pincode;
      if (landmark) updateObject.landmark = landmark;
      if (address) updateObject.address = address;
      if (city) updateObject.city = city;
      if (state) updateObject.state = state;
      if (country) updateObject.country = country;

      const updatedAddress = await Address.findByIdAndUpdate(
            addressId,
            { $set: updateObject },
            { new: true }
      );

      if (!updatedAddress) throw new APIError(500, "Error while updating Address");

      return res
            .status(200)
            .json(new APIResponse(200, updatedAddress, "Address updated Successfully"));
});


const deleteAddress = asyncHandler(async (req, res) => {
      const userId = req.user?._id;
      if (!userId) throw new APIError(401, "Unauthorized Access");

      const { addressId } = req.params;
      if (!addressId) throw new APIError(400, "Please provide Address Id");

      const addressToDelete = await Address.findByIdAndDelete({
            _id: addressId,
            user: userId,
      });

      if (!addressToDelete) throw new APIError(500, "Error while deleting Address");

      return res
            .status(200)
            .json(new APIResponse(200, addressToDelete, "Address deleted Successfully"));
});


export {
      addNewAddress,
      fetchAddresses,
      updateAddress,
      deleteAddress
}