import Course from "../models/Course.js";

// Create Course
export const createCourse = async (req, res) => {
  const { title, description, category, status, duration, level, mode, schedule, certificate, imageUrl, modules, highlights } = req.body;

  if (!title || !description) {
    return res.status(400).json({ success: false, message: "Title and description are required." });
  }

  try {
    const course = await Course.create({
      title,
      description,
      category,
      status,
      duration,
      level,
      mode,
      schedule,
      certificate: certificate !== undefined ? certificate : true,
      imageUrl: imageUrl || "",
      modules: modules || [],
      highlights: highlights || [],
    });

    res.status(201).json({ success: true, data: course });
  } catch (error) {
    console.error("Create Course Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Get all active courses (Public)
export const getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find({ isActive: true }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: courses });
  } catch (error) {
    console.error("Get Courses Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Get all courses (Admin)
export const getAllCoursesAdmin = async (req, res) => {
  try {
    const courses = await Course.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: courses });
  } catch (error) {
    console.error("Get Admin Courses Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Update Course
export const updateCourse = async (req, res) => {
  const { id } = req.params;
  const { title, description, category, status, duration, level, mode, schedule, certificate, imageUrl, modules, highlights, isActive } = req.body;

  try {
    let course = await Course.findById(id);

    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }

    course.title = title || course.title;
    course.description = description || course.description;
    course.category = category || course.category;
    course.status = status || course.status;
    course.duration = duration !== undefined ? duration : course.duration;
    course.level = level !== undefined ? level : course.level;
    course.mode = mode !== undefined ? mode : course.mode;
    course.schedule = schedule !== undefined ? schedule : course.schedule;
    if (certificate !== undefined) course.certificate = certificate;
    course.imageUrl = imageUrl !== undefined ? imageUrl : course.imageUrl;
    if (modules !== undefined) course.modules = modules;
    if (highlights !== undefined) course.highlights = highlights;
    if (isActive !== undefined) course.isActive = isActive;

    await course.save();

    res.status(200).json({ success: true, data: course });
  } catch (error) {
    console.error("Update Course Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Toggle Course active status
export const toggleCourseStatus = async (req, res) => {
  const { id } = req.params;

  try {
    const course = await Course.findById(id);

    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }

    course.isActive = !course.isActive;
    await course.save();

    res.status(200).json({ success: true, data: course });
  } catch (error) {
    console.error("Toggle Course Status Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Delete Course
export const deleteCourse = async (req, res) => {
  const { id } = req.params;

  try {
    const course = await Course.findByIdAndDelete(id);

    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }

    res.status(200).json({ success: true, message: "Course deleted successfully." });
  } catch (error) {
    console.error("Delete Course Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
