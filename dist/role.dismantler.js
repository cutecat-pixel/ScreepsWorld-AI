/**
 * Dismantler Role
 * Moves to a target room and dismantles the Invader Core.
 */
const roleDismantler = {
    /**
     * @param {Creep} creep
     */
    run: function(creep) {
        const targetRoomName = creep.memory.targetRoom;
        const homeRoomName = creep.memory.homeRoom;

        // 1. Handle Inter-Room Travel
        if (creep.room.name !== targetRoomName) {
            creep.say(`✈️`);
            const exitDir = Game.map.findExit(creep.room.name, targetRoomName);
            if (exitDir === ERR_NO_PATH) {
                console.log(`${creep.name} cannot find path to target room ${targetRoomName}.`);
                creep.say('❌Path');
                // Consider self-recycling or returning home logic here
                return;
            }
            const exit = creep.pos.findClosestByRange(exitDir);
            creep.moveTo(exit, { visualizePathStyle: { stroke: '#ff00ff' }, reusePath: 50 });
            return;
        }

        // 2. Find and Target Invader Core
        let core = null;
        if (creep.memory.coreId) {
            core = Game.getObjectById(creep.memory.coreId);
            // Clear memory if core is destroyed or no longer visible
            if (!core) {
                delete creep.memory.coreId;
            }
        } 
        
        if (!core) {
            const cores = creep.room.find(FIND_HOSTILE_STRUCTURES, {
                filter: { structureType: STRUCTURE_INVADER_CORE }
            });
            if (cores.length > 0) {
                core = cores[0];
                creep.memory.coreId = core.id;
            }
        }

        // 3. Dismantle or Move to Core
        if (core) {
            creep.say('⛏️ ');
            const dismantleResult = creep.attack(core);
            if (dismantleResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(core, { visualizePathStyle: { stroke: '#ff0000' }, reusePath: 5 });
            } else if (dismantleResult !== OK) {
                 console.log(`${creep.name} dismantle failed with code: ${dismantleResult}`);
                 // Maybe stuck? Add logic to move away slightly if needed.
            }
        } else {
            // No core found in the target room
            creep.say('❓');
            // console.log(`${creep.name} arrived in ${targetRoomName} but found no Invader Core.`);
            // Options: move to center, move to a flag, recycle, return home.
            // Simple: Move towards center/idle
            creep.moveTo(new RoomPosition(25, 25, targetRoomName), { visualizePathStyle: { stroke: '#cccccc' }, range: 5 });
            // Consider adding self-recycling logic if idle for too long
            // if(!creep.memory.idleTicks) creep.memory.idleTicks = 0;
            // creep.memory.idleTicks++;
            // if(creep.memory.idleTicks > 100) creep.memory.recycle = true; 
        }
    },

    /**
     * Generates body parts for the Dismantler. Focuses on WORK and MOVE.
     * @param {number} energy - Available energy.
     * @param {Object} gameStage - Current game stage for the room.
     * @returns {BodyPartConstant[]} Array of body parts.
     */
    getBody: function(energy, gameStage) {
        let body = [];
        
        if(gameStage.level >= 4 && energy >= 750) {
            // 中级阶段配置
            body = [ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, 
                   MOVE, MOVE, MOVE, MOVE, MOVE];
        }
        else if(energy >= 500) {
            // 基础配置
            body = [ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE];
        }
        else {
            // 最小配置
            body = [ATTACK, ATTACK, MOVE, MOVE];
        }
        
        return body;
    }
};

module.exports = roleDismantler; 