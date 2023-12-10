const ElasticEmail = require("@elasticemail/elasticemail-client");

const { EMAIL_API_KEY, BASE_URL } = process.env;

const defaultClient = ElasticEmail.ApiClient.instance;
const apikey = defaultClient.authentications["apikey"];

apikey.apiKey = EMAIL_API_KEY;

const api = new ElasticEmail.EmailsApi();

const sendVerificationEmail = async ({ recipient, verificationToken }) => {
  const email = {
    Recipients: {
      To: [recipient],
    },
    Content: {
      Body: [
        {
          ContentType: "HTML",
          Charset: "utf-8",
          Content: `<a href="${BASE_URL}/users/verify/${verificationToken}" target="_blank">Click here to verify email</a>`,
        },
        {
          ContentType: "PlainText",
          Charset: "utf-8",
          Content: `Follow this link to verify email ${BASE_URL}/users/verify/${verificationToken}`,
        },
      ],
      From: "ivanbilobrov07@gmail.com",
      Subject: "Verificational Email",
    },
  };

  api.emailsTransactionalPost(email);
};

module.exports = sendVerificationEmail;
