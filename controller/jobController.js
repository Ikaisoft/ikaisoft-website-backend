import Job from "../models/Job.js";
import JobApplication from "../models/JobApplication.js";

// Create Job
export const createJob = async (req, res) => {
  const { title, type, team, location, summary, tags } = req.body;

  if (!title || !summary) {
    return res.status(400).json({ success: false, message: "Title and summary are required." });
  }

  try {
    const job = await Job.create({
      title,
      type,
      team,
      location,
      summary,
      tags: tags || [],
    });

    res.status(201).json({ success: true, data: job });
  } catch (error) {
    console.error("Create Job Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Get all active jobs (Public)
export const getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ isActive: true }).sort({ createdAt: -1 });
    const jobsWithCounts = await Promise.all(
      jobs.map(async (job) => {
        const applicantCount = await JobApplication.countDocuments({ jobId: job._id });
        return { ...job.toObject(), applicantCount };
      })
    );

    res.status(200).json({ success: true, data: jobsWithCounts });
  } catch (error) {
    console.error("Get Jobs Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Get all jobs (Admin)
export const getAllJobsAdmin = async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 });
    const jobsWithCounts = await Promise.all(
      jobs.map(async (job) => {
        const applicantCount = await JobApplication.countDocuments({ jobId: job._id });
        return { ...job.toObject(), applicantCount };
      })
    );

    res.status(200).json({ success: true, data: jobsWithCounts });
  } catch (error) {
    console.error("Get Admin Jobs Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Update Job
export const updateJob = async (req, res) => {
  const { id } = req.params;
  const { title, type, team, location, summary, tags, isActive } = req.body;

  try {
    let job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found." });
    }

    job.title = title || job.title;
    job.type = type || job.type;
    job.team = team || job.team;
    job.location = location || job.location;
    job.summary = summary || job.summary;
    if (tags !== undefined) job.tags = tags;
    if (isActive !== undefined) job.isActive = isActive;

    await job.save();

    res.status(200).json({ success: true, data: job });
  } catch (error) {
    console.error("Update Job Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Toggle Job active/inactive status
export const toggleJobStatus = async (req, res) => {
  const { id } = req.params;

  try {
    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found." });
    }

    job.isActive = !job.isActive;
    await job.save();

    res.status(200).json({ success: true, data: job });
  } catch (error) {
    console.error("Toggle Job Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Delete Job
export const deleteJob = async (req, res) => {
  const { id } = req.params;

  try {
    const job = await Job.findByIdAndDelete(id);

    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found." });
    }

    await JobApplication.deleteMany({ jobId: id });

    res.status(200).json({ success: true, message: "Job deleted successfully." });
  } catch (error) {
    console.error("Delete Job Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Submit job application
export const submitJobApplication = async (req, res) => {
  const { jobId, fullName, email, phone, experience, education, message, resumeName, resumeType, resumeData } = req.body;

  if (!jobId || !fullName || !email || !phone) {
    return res.status(400).json({ success: false, message: "Job ID, full name, email, and phone are required." });
  }

  try {
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found." });
    }

    const application = await JobApplication.create({
      jobId,
      fullName,
      email,
      phone,
      experience,
      education,
      message,
      resumeName,
      resumeType,
      resumeData,
    });

    res.status(201).json({ success: true, data: application, message: "Application submitted successfully." });
  } catch (error) {
    console.error("Submit Application Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Get applications for a job (Admin)
export const getJobApplications = async (req, res) => {
  const { id } = req.params;

  try {
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found." });
    }

    const applications = await JobApplication.find({ jobId: id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: applications });
  } catch (error) {
    console.error("Get Job Applications Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
