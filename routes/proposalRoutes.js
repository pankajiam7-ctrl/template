// routes/proposalRoutes.js
import express from 'express'
import {
  generateProposal,
} from '../controllers/proposalController.js'
// import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

// All routes protected — login required
//router.use(protect)

router.post('/generate',  generateProposal)   // POST   /api/proposals/generate
// router.get('/',           getMyProposals)      // GET    /api/proposals
// router.get('/:id',        getProposal)         // GET    /api/proposals/:id
// router.delete('/:id',     deleteProposal)      // DELETE /api/proposals/:id

export default router
