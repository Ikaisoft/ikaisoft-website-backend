import Admin from "../models/Admin.js";
import bcrypt from "bcryptjs";

const seedAdmin = async () => {
  try {
    const adminExists = await Admin.findOne({ email: "admin@ikaisoft.com" });

    if (!adminExists) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("Admin@123", salt);

      await Admin.create({
        name: "Super Admin",
        email: "admin@ikaisoft.com",
        password: hashedPassword,
      });

      console.log("Default Admin seeded successfully (admin@ikaisoft.com / Admin@123) 🔑");
    } else {
      console.log("Admin user already exists, skipping seeding.");
    }
  } catch (error) {
    console.error("Error seeding Admin:", error);
  }
};

export default seedAdmin;
