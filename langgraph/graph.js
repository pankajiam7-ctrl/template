// langgraph/graph.js
import { StateGraph, END }    from '@langchain/langgraph'
import { proposalState }       from './state.js'
import { enhanceInput }        from './inputEnhancer.js'
import {
  generateOutline,
  generateProposal,
  evaluateProposal,
  checkGeneric
}                              from './nodes.js'
import { validateConsistency } from './consistencyValidator.js'

const graph = new StateGraph({ channels: proposalState })

// Add all nodes
graph.addNode('node_enhance',     enhanceInput)       // Node 0
graph.addNode('node_outline',     generateOutline)    // Node 1
graph.addNode('node_proposal',    generateProposal)   // Node 2
graph.addNode('node_evaluate',    evaluateProposal)   // Node 3
graph.addNode('node_consistency', validateConsistency) // Node 3.5
graph.addNode('node_generic',     checkGeneric)       // Node 4

// Pipeline
graph.setEntryPoint('node_enhance')
graph.addEdge('node_enhance',     'node_outline')
graph.addEdge('node_outline',     'node_proposal')
graph.addEdge('node_proposal',    'node_evaluate')
graph.addEdge('node_evaluate',    'node_consistency')
graph.addEdge('node_consistency', 'node_generic')
graph.addEdge('node_generic',     END)

export const proposalGraph = graph.compile()
