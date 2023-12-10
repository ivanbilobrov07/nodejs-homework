const path = require("path");
const { nanoid } = require("nanoid");
const fs = require("fs/promises");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const gravatar = require("gravatar");

const { User } = require("../models/user");
const {
  ctrlWrapper,
  HttpError,
  resizeImage,
  sendVerificationEmail,
} = require("../helpers");

const { SECRET_KEY } = process.env;
const imageStorage = path.join(__dirname, "../", "public");

const register = async (req, res) => {
  const { body } = req;

  if (await User.findOne({ email: body.email }))
    throw HttpError({ status: 409, message: "This email is already in use" });

  const hashedPassword = await bcrypt.hash(body.password, 10);
  const avatar = gravatar.url(body.email, { s: "250" });
  const verificationToken = nanoid();

  const { email, subscription, avatarURL } = await User.create({
    ...body,
    password: hashedPassword,
    verificationToken,
    avatarURL: avatar,
  });

  await sendVerificationEmail({ recipient: email, verificationToken });

  res.status(201).json({ user: { email, subscription, avatarURL } });
};

const verifyEmail = async (req, res) => {
  const { verificationToken } = req.params;

  const user = await User.findOne({ verificationToken });

  if (!user)
    throw HttpError({
      status: 404,
      message: "User was not found or email is already verified",
    });

  await User.findByIdAndUpdate(user._id, {
    verificationToken: null,
    verify: true,
  });
  res.json({ message: "Verification successful" });
};

const resendVerificationEmail = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) throw HttpError({ status: 404, message: "User not found" });

  if (user.verify)
    throw HttpError({ status: 400, message: "Email is already verified" });

  await sendVerificationEmail({
    recipient: email,
    verificationToken: user.verificationToken,
  });

  res.json({ message: "Verification email was sent successfully" });
};

const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user)
    throw HttpError({ status: 401, message: "Email or password is wrong" });

  if (!user.verify)
    throw HttpError({ status: 401, message: "Email does not verified" });

  if (!(await bcrypt.compare(password, user.password))) {
    throw HttpError({ status: 401, message: "Email or password is wrong" });
  }

  const payload = { id: user.id };
  const token = jwt.sign(payload, SECRET_KEY, { expiresIn: "1d" });

  const updatedUser = await User.findByIdAndUpdate(
    user.id,
    { token },
    { new: true }
  );

  res.json({
    token: updatedUser.token,
    user: {
      email: updatedUser.email,
      subscription: updatedUser.subscription,
    },
  });
};

const logout = async (req, res) => {
  const { _id } = req.user;
  await User.findByIdAndUpdate(_id, { token: null });

  res.status(204).json();
};

const getCurrent = (req, res) => {
  const { email, subscription } = req.user;

  res.json({ email, subscription });
};

const updateAvatar = async (req, res) => {
  if (!req.file)
    throw HttpError({ status: 400, message: "Please provide an avatar image" });

  const { path: tempUpload, originalname } = req.file;
  const { _id } = req.user;

  const fileName = `${_id}_${originalname}`;
  const resultUpload = path.join(imageStorage, "avatars", fileName);

  await resizeImage(tempUpload, 250, 250);
  await fs.rename(tempUpload, resultUpload);

  const avatarURL = path.join("avatars", fileName);
  const prevAvatar = (await User.findById(_id)).avatarURL;

  if (!prevAvatar.includes("gravatar")) {
    await fs.unlink(path.join("public", prevAvatar));
  }

  await User.findByIdAndUpdate(_id, { avatarURL });

  res.json({ avatarURL });
};

const updateSubscriptionType = async (req, res) => {
  const { subscription } = req.body;
  const { _id } = req.user;

  const user = await User.findByIdAndUpdate(
    _id,
    { subscription },
    { new: true }
  );

  res.json(user);
};

module.exports = {
  register: ctrlWrapper(register),
  login: ctrlWrapper(login),
  getCurrent: ctrlWrapper(getCurrent),
  logout: ctrlWrapper(logout),
  updateAvatar: ctrlWrapper(updateAvatar),
  updateSubscriptionType: ctrlWrapper(updateSubscriptionType),
  verifyEmail: ctrlWrapper(verifyEmail),
  resendVerificationEmail: ctrlWrapper(resendVerificationEmail),
};
