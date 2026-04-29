/**
 * LogGuard API
 *
 * Backend REST sencillo para el dashboard:
 * - Se conecta a MongoDB
 * - Lee colecciones `logs` y `alerts`
 * - Expone endpoints para que el frontend pinte datos
 */

import "./load-env.js"
import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"

const PORT = Number.parseInt(process.env.PORT || "4000", 10)
const MONGODB_URL =
  process.env.MONGODB_URL || "mongodb://admin:logguard123@localhost:27017/logguard?authSource=admin"
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "logguard"
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000"

const app = express()

app.use(
  cors({
    origin: CORS_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
)
app.use(express.json())

let mongoClient
let db

function logsCollection() {
  return db.collection("logs")
}

function alertsCollection() {
  return db.collection("alerts")
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function safeRegex(value) {
  return { $regex: String(value), $options: "i" }
}

function toTimestampDateExpression(fieldName) {
  return {
    $switch: {
      branches: [
        {
          case: { $eq: [{ $type: fieldName }, "date"] },
          then: fieldName,
        },
        {
          case: { $eq: [{ $type: fieldName }, "string"] },
          then: {
            $dateFromString: {
              dateString: fieldName,
              onError: null,
              onNull: null,
            },
          },
        },
      ],
      default: null,
    },
  }
}

function buildTimestampRangeQuery(params = {}) {
  const query = {}
  if (params.from || params.to) {
    query.timestamp = {}
    if (params.from) query.timestamp.$gte = params.from
    if (params.to) query.timestamp.$lte = params.to
  }
  return query
}

async function connectMongoDB() {
  const maxRetries = 10
  const retryDelayMs = 5000

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      mongoClient = new MongoClient(MONGODB_URL)
      await mongoClient.connect()
      db = mongoClient.db(MONGODB_DB_NAME)
      console.log(`Connected to MongoDB database: ${MONGODB_DB_NAME}`)
      return
    } catch (error) {
      console.warn(`MongoDB connection attempt ${attempt}/${maxRetries} failed:`, error.message)
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
      }
    }
  }

  throw new Error("Failed to connect to MongoDB")
}

async function getLogs(params = {}) {
  const page = parsePositiveInt(params.page, 1)
  const limit = parsePositiveInt(params.limit, 50)
  const query = {}

  if (params.label) query.label = params.label
  if (params.severity) query.severity = params.severity
  if (params.src_ip) query.src_ip = safeRegex(params.src_ip)
  if (params.dst_ip) query.dst_ip = safeRegex(params.dst_ip)
  if (params.protocol) query.protocol = params.protocol

  Object.assign(query, buildTimestampRangeQuery(params))

  const skip = (page - 1) * limit

  const [logs, total, severityCounts] = await Promise.all([
    logsCollection().find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).toArray(),
    logsCollection().countDocuments(query),
    logsCollection()
      .aggregate([{ $match: query }, { $group: { _id: "$severity", count: { $sum: 1 } } }])
      .toArray(),
  ])

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    summary: {
      bySeverity: severityCounts.reduce((acc, row) => ({ ...acc, [row._id]: row.count }), {}),
    },
  }
}

async function getDashboardStats(params = {}) {
  const query = buildTimestampRangeQuery(params)

  const [totalLogs, totalAttacks, activeAlerts, labelCounts, severityCounts] = await Promise.all([
    logsCollection().countDocuments(query),
    logsCollection().countDocuments({ ...query, label: { $ne: "Benign" } }),
    alertsCollection().countDocuments({ acknowledged: false }),
    logsCollection()
      .aggregate([{ $match: query }, { $group: { _id: "$label", count: { $sum: 1 } } }])
      .toArray(),
    logsCollection()
      .aggregate([{ $match: query }, { $group: { _id: "$severity", count: { $sum: 1 } } }])
      .toArray(),
  ])

  return {
    totalLogs,
    totalAttacks,
    totalBenign: totalLogs - totalAttacks,
    activeAlerts,
    attackRate: totalLogs > 0 ? ((totalAttacks / totalLogs) * 100).toFixed(2) : 0,
    byLabel: labelCounts.reduce((acc, row) => ({ ...acc, [row._id]: row.count }), {}),
    bySeverity: severityCounts.reduce((acc, row) => ({ ...acc, [row._id]: row.count }), {}),
  }
}

async function getFilteredTrafficTimeline(params = {}) {
  const baseQuery = buildTimestampRangeQuery(params)

  const pipeline = [
    ...(Object.keys(baseQuery).length > 0 ? [{ $match: baseQuery }] : []),
    {
      $addFields: {
        timestampDate: toTimestampDateExpression("$timestamp"),
      },
    },
    {
      $match: {
        timestampDate: { $ne: null },
      },
    },
    {
      $sort: {
        timestampDate: -1,
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d %H:00",
            date: "$timestampDate",
            timezone: "UTC",
          },
        },
        total: { $sum: 1 },
        attacks: {
          $sum: { $cond: [{ $ne: ["$label", "Benign"] }, 1, 0] },
        },
        highRisk: {
          $sum: {
            $cond: [{ $in: ["$severity", ["high", "critical"]] }, 1, 0],
          },
        },
        preview: {
          $push: {
            id: "$id",
            timestamp: "$timestamp",
            src_ip: "$src_ip",
            dst_ip: "$dst_ip",
            protocol: "$protocol",
            label: "$label",
            severity: "$severity",
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]

  const rows = await logsCollection().aggregate(pipeline).toArray()

  return rows.map((row) => ({
    timestamp: row._id,
    total: row.total,
    attacks: row.attacks,
    highRisk: row.highRisk,
    preview: Array.isArray(row.preview) ? row.preview.slice(0, 3) : [],
  }))
}

async function getAlertTrend(hours) {
  const parsedHours = Number.parseInt(String(hours ?? ""), 10)
  const useLookbackFilter = Number.isFinite(parsedHours) && parsedHours > 0
  const since = useLookbackFilter ? new Date(Date.now() - parsedHours * 60 * 60 * 1000) : null

  const pipeline = [
    {
      $addFields: {
        timestampDate: toTimestampDateExpression("$timestamp"),
      },
    },
    {
      $match: {
        acknowledged: false,
        ...(useLookbackFilter ? { timestampDate: { $gte: since } } : { timestampDate: { $ne: null } }),
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d %H:00",
            date: "$timestampDate",
            timezone: "UTC",
          },
        },
        activeAlerts: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]

  const rows = await alertsCollection().aggregate(pipeline).toArray()
  return rows.map((row) => ({
    timestamp: row._id,
    activeAlerts: row.activeAlerts,
  }))
}

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "api-log-guard",
    mongodb: Boolean(db),
    database: MONGODB_DB_NAME,
    timestamp: new Date().toISOString(),
  })
})

app.get("/api/logs", async (req, res) => {
  try {
    res.json(await getLogs(req.query))
  } catch (error) {
    console.error("Error fetching logs:", error)
    res.status(500).json({ error: "Failed to fetch logs" })
  }
})

app.get("/api/logs/:id", async (req, res) => {
  try {
    const log = await logsCollection().findOne({ id: req.params.id })
    if (!log) {
      return res.status(404).json({ error: "Log not found" })
    }
    return res.json(log)
  } catch (error) {
    console.error("Error fetching log:", error)
    return res.status(500).json({ error: "Failed to fetch log" })
  }
})

app.get("/api/alerts", async (req, res) => {
  try {
    const limit = parsePositiveInt(req.query.limit, 50)
    const query = {}

    if (req.query.acknowledged !== undefined) {
      query.acknowledged = req.query.acknowledged === "true"
    }

    const alerts = await alertsCollection().find(query).sort({ timestamp: -1 }).limit(limit).toArray()
    res.json(alerts)
  } catch (error) {
    console.error("Error fetching alerts:", error)
    res.status(500).json({ error: "Failed to fetch alerts" })
  }
})

app.put("/api/alerts/:id/acknowledge", async (req, res) => {
  try {
    const result = await alertsCollection().updateOne({ id: req.params.id }, { $set: { acknowledged: true } })
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Alert not found" })
    }
    return res.json({ success: true })
  } catch (error) {
    console.error("Error acknowledging alert:", error)
    return res.status(500).json({ error: "Failed to acknowledge alert" })
  }
})

app.get("/api/stats/dashboard", async (req, res) => {
  try {
    res.json(await getDashboardStats(req.query))
  } catch (error) {
    console.error("Error fetching dashboard stats:", error)
    res.status(500).json({ error: "Failed to fetch dashboard stats" })
  }
})

app.get("/api/stats/timeline", async (req, res) => {
  try {
    res.json(await getFilteredTrafficTimeline(req.query))
  } catch (error) {
    console.error("Error fetching filtered traffic timeline:", error)
    res.status(500).json({ error: "Failed to fetch filtered traffic timeline" })
  }
})

app.get("/api/stats/traffic", async (req, res) => {
  try {
    const parsedHours = Number.parseInt(String(req.query.hours ?? ""), 10)
    const useLookbackFilter = Number.isFinite(parsedHours) && parsedHours > 0
    const since = useLookbackFilter ? new Date(Date.now() - parsedHours * 60 * 60 * 1000) : null

    const pipeline = [
      {
        $addFields: {
          timestampDate: toTimestampDateExpression("$timestamp"),
        },
      },
      ...(useLookbackFilter
        ? [{ $match: { timestampDate: { $gte: since } } }]
        : [{ $match: { timestampDate: { $ne: null } } }]),
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d %H:00",
              date: "$timestampDate",
              timezone: "UTC",
            },
          },
          benign: {
            $sum: { $cond: [{ $eq: ["$label", "Benign"] }, 1, 0] },
          },
          attacks: {
            $sum: { $cond: [{ $ne: ["$label", "Benign"] }, 1, 0] },
          },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]

    const traffic = await logsCollection().aggregate(pipeline).toArray()
    res.json(
      traffic.map((row) => ({
        timestamp: row._id,
        benign: row.benign,
        attacks: row.attacks,
        total: row.total,
      })),
    )
  } catch (error) {
    console.error("Error fetching traffic stats:", error)
    res.status(500).json({ error: "Failed to fetch traffic stats" })
  }
})

app.get("/api/stats/attacks", async (req, res) => {
  try {
    const query = { ...buildTimestampRangeQuery(req.query), label: { $ne: "Benign" } }

    const attacks = await logsCollection()
      .aggregate([
        { $match: query },
        { $group: { _id: "$label", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray()

    res.json(attacks.map((row) => ({ type: row._id, count: row.count })))
  } catch (error) {
    console.error("Error fetching attack stats:", error)
    res.status(500).json({ error: "Failed to fetch attack stats" })
  }
})

app.get("/api/stats/alerts-trend", async (req, res) => {
  try {
    res.json(await getAlertTrend(req.query.hours))
  } catch (error) {
    console.error("Error fetching alert trend:", error)
    res.status(500).json({ error: "Failed to fetch alert trend" })
  }
})

app.get("/api/stats/top-sources", async (req, res) => {
  try {
    const limit = parsePositiveInt(req.query.limit, 10)
    const query = { ...buildTimestampRangeQuery(req.query), label: { $ne: "Benign" } }

    const sources = await logsCollection()
      .aggregate([
        { $match: query },
        {
          $group: {
            _id: "$src_ip",
            attacks: { $sum: 1 },
            types: { $addToSet: "$label" },
          },
        },
        { $sort: { attacks: -1 } },
        { $limit: limit },
      ])
      .toArray()

    res.json(sources.map((row) => ({ ip: row._id, attacks: row.attacks, types: row.types })))
  } catch (error) {
    console.error("Error fetching top sources:", error)
    res.status(500).json({ error: "Failed to fetch top sources" })
  }
})

app.get("/api/stats/protocols", async (req, res) => {
  try {
    const query = buildTimestampRangeQuery(req.query)

    const protocols = await logsCollection()
      .aggregate([
        { $match: query },
        {
          $group: {
            _id: "$protocol",
            count: { $sum: 1 },
            attacks: {
              $sum: { $cond: [{ $ne: ["$label", "Benign"] }, 1, 0] },
            },
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray()

    res.json(protocols.map((row) => ({ protocol: row._id, total: row.count, attacks: row.attacks })))
  } catch (error) {
    console.error("Error fetching protocol stats:", error)
    res.status(500).json({ error: "Failed to fetch protocol stats" })
  }
})

async function shutdown() {
  console.log("Shutting down gracefully...")
  if (mongoClient) {
    await mongoClient.close()
  }
  console.log("Shutdown complete")
  process.exit(0)
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)

async function start() {
  console.log("=".repeat(50))
  console.log("Starting api-log-guard")
  console.log("=".repeat(50))
  await connectMongoDB()
  app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`)
    console.log(`CORS enabled for: ${CORS_ORIGIN}`)
    console.log(`Database selected: ${MONGODB_DB_NAME}`)
  })
}

start().catch((error) => {
  console.error("Fatal startup error:", error)
  process.exit(1)
})
