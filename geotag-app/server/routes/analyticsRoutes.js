const express=require('express');
const mongoose=require('mongoose');
const router= express.Router();
const verifyToken=require('../middleware/verifyToken');
const Memory=require('../models/memories')

router.get('/totalmemorycount',verifyToken,async(req,res)=>{
   const count = await Memory.countDocuments({ userId: req.userId });//counts without fetching all documents
   res.status(200).json({count:count});
});



router.get('/monthlymemorycount', verifyToken, async (req, res) => {
  try {
    const monthlyCounts = await Memory.aggregate([
     { $match: { userId: new mongoose.Types.ObjectId(req.userId) } },
   //mongoose.Types.ObjectId( means check userId=ObjectId(the id string) ) aggregate needs this
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    res.status(200).json(monthlyCounts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch monthly memory count" });
  }
});
//this type of data  [ { _id: { year: 2025, month: 10 }, count: 2 } ]
/*
Key points

Purpose:
Summarize, group, filter, sort, calculate averages, counts, totals, or reshape data.
Similar to SQL queries with WHERE, GROUP BY, ORDER BY, and aggregation functions.

Stages:
$match → filter documents
$group → group documents and calculate aggregations (sum, avg, count, etc.)
$sort → order results
$project → reshape documents (pick or compute fields)Reshape documents (add/rename fields)
$limit / $skip → pagination
$lookup → join with other collections Join with other collections

Output:
Returns an array of documents that is the result of all pipeline transformations.
 */


module.exports=router;