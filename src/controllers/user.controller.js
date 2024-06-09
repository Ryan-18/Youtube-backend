import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";


const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken=user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        
        user.refreshToken = refreshToken
       await user.save({validateBeforeSave:false})

       return {accessToken,refreshToken}
    } catch (error) {
        throw new ApiError(500,"something went wrong while generating tokens")
    }
}






const registerUser = asyncHandler(async (req, res) => {
//     res.status(200).json({
//         message:"Ryan aur Code"
//     })
    
    

   
    
   

    
    
    
    // get user details from thunder client 
    // get the data from req.body 
    const { fullName, email, username, password } = req.body
   console.log("email", email)



// validation  - not empty
    // if (fullName === "") {
    //     throw new ApiError(400,"fullName is required")
    // }
    if([fullName,email,password,username].some((field)=>field?.trim() ==="")) {
        throw new ApiError(400,"All fields are required")
    }




// chech if user already exist  :  username,email
 const existedUser =  await  User.findOne({
      $or: [ { username },{ email }]
  })
    if (existedUser) {
    throw new ApiError(409,"user already exist")
    }



    // check for images , check for avatar
    
   //console.log('Files:', req.files); 
    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0)
    {
        coverImageLocalPath = req.files.coverImage[0].path;
        }
    if (!avatarLocalPath) {
        throw new ApiError(400,"Avatar file is required")
    }



       
    // upload them to cloudinary , avatar
    const avatar=await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!avatar) {
        throw new ApiError(400,"Avatar file is required")
    }



 // create user object - create entry in db
   const user =  await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
   })
    
    
    // remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

     // check for user creation 
    if (!createdUser) {
        throw new ApiError(500,"Something went wrong while registering the user")
    }

    // return response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

})

const loginUser = asyncHandler(async (req, res) => {
    // req body -> data
    // username or email
    // find the user
    // check the password 
    // access and refresh token
    // send cookie
    const { email, username, password } = req.body
    if (!username || !email) {
        throw new ApiError(400, "username or password is required!")
        
    }
   const user = await  User.findOne({
        $or: [ { username }, { email } ]
   })
    if (!user) {
        throw new ApiError(404, "User does not exist")
    }


    const isPasswordValid = await user.isPasswordCorrect(password);
     if (!isPasswordValid) {
        throw new ApiError(401, "Invalid password!  ")
    }

    const {accessToken,refreshToken }=await generateAccessAndRefreshTokens(user._id)
    const LoggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpsOnly: true,
        secure:true
    }
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200, {
                user: LoggedInUser,accessToken,refreshToken
            },
            "User logged in Successfully")
        )

})


const logoutUser = asyncHandler(async (req, res) => {
   await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken:undefined
            }
        },
        {
            new:true
        }
    )
const options = {
        httpsOnly: true,
        secure:true
    }

    return res
        .status(200)
        .clearCookie("accessToken",options)
        .clearCookie("refreshToken",options)
        .json(new ApiResponse(200, {},"User Logged out successfully"))


})

export {
    registerUser,
    loginUser,
    logoutUser
}