const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary with your credentials
// These should be set in your .env file
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'memories',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    public_id: (req, file) => `memory-${Date.now()}`,
  },
});

const upload = multer({ storage: storage });

module.exports = { cloudinary, upload };
