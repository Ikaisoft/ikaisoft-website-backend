import Job from "../models/Job.js";

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
    res.status(200).json({ success: true, data: jobs });
  } catch (error) {
    console.error("Get Jobs Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Get all jobs (Admin)
export const getAllJobsAdmin = async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: jobs });
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

    res.status(200).json({ success: true, message: "Job deleted successfully." });
  } catch (error) {
    console.error("Delete Job Error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
