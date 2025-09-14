const bcrypt = require("bcryptjs");

async function runTest() {
  const password = "123456";
  const hashed = await bcrypt.hash(password, 10);
  console.log("Hashed:", hashed);

  const match = await bcrypt.compare("123456", hashed);
  console.log("Password Match:", match);
}

runTest();
