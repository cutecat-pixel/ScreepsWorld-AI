// 角色模块集合
module.exports = {
    harvester: require('role.harvester'),
    upgrader: require('role.upgrader'),
    builder: require('role.builder'),
    repairer: require('role.repairer'),
    miner: require('role.miner'),
    hauler: require('role.hauler'),
    defender: require('role.defender'),
    claimer: require('role.claimer'),
    // dismantler: require('role.dismantler'), // Old generic dismantler (if any)
    wallRepairer: require('role.wallRepairer'),
    remoteMiner: require('role.remoteMiner'),
    remoteHauler: require('role.remoteHauler'),
    transfer: require('role.transfer'),
    signer: require('role.signer'),
    remoteBuilder: require('role.remoteBuilder'),
    mineralHarvester: require('role.mineralHarvester'),
    mineralHauler: require('role.mineralHauler'),
    terminalHauler: require('role.terminalHauler'),
    powerHauler: require('role.powerHauler'),
    labHauler: require('role.labHauler'),
    dismantler: require('role.dismantler') // Add specific Dismantler role
}; 