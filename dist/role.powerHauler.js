/**
 * Power运输者角色模块
 * 负责从Storage/Terminal收集Power，并将其运输到PowerSpawn
 */
const rolePowerHauler = {
    /**
     * PowerHauler的主要运行逻辑
     * @param {Creep} creep - 要控制的creep对象
     */
    run: function(creep) {
        // 初始化状态
        if(creep.memory.collecting === undefined) {
            creep.memory.collecting = true;
        }
        
        // 状态切换逻辑
        if(creep.memory.collecting && creep.store.getFreeCapacity() === 0) {
            creep.memory.collecting = false;
            creep.say('📦 送Power');
        }
        if(!creep.memory.collecting && creep.store.getUsedCapacity(RESOURCE_POWER) === 0) {
            creep.memory.collecting = true;
            creep.say('🔄 取Power');
        }
        
        // 如果不在家乡房间，先回家
        if(creep.memory.homeRoom && creep.room.name !== creep.memory.homeRoom) {
            creep.moveTo(new RoomPosition(25, 25, creep.memory.homeRoom), {
                visualizePathStyle: {stroke: '#a9d1ff'}
            });
            return;
        }
        
        // 获取PowerSpawn，检查是否需要运送Power
        const powerSpawn = creep.room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_POWER_SPAWN
        })[0];
        
        // 如果没有PowerSpawn或PowerSpawn已满，进入待命状态
        if(!powerSpawn || powerSpawn.store[RESOURCE_POWER] >= 50) {
            // 如果身上有Power，先放回Storage
            if(creep.store.getUsedCapacity(RESOURCE_POWER) > 0) {
                this.returnPowerToStorage(creep);
                return;
            }
            
            // 设置为非工作状态，进入待命
            creep.memory.powerPause = true;
            this.idleBehavior(creep);
            return;
        }
        
        // 如果之前是暂停状态，现在有工作了，重置暂停标志
        if(creep.memory.powerPause) {
            creep.memory.powerPause = false;
        }
        
        // 正常的收集和运送逻辑
        // 收集模式：从Storage或Terminal获取Power
        if(creep.memory.collecting) {
            this.collectPower(creep);
        }
        // 运输模式：将Power送到PowerSpawn
        else {
            this.deliverPower(creep);
        }
    },
    
    /**
     * 从Storage或Terminal收集Power
     * @param {Creep} creep - Creep对象
     */
    collectPower: function(creep) {
        const room = creep.room;
        
        // 决定从哪里收集Power
        let source = null;
        
        // 优先从Storage收集
        if(room.storage && room.storage.store[RESOURCE_POWER] > 0) {
            source = room.storage;
        }
        // 其次从Terminal收集
        else if(room.terminal && room.terminal.store[RESOURCE_POWER] > 0) {
            source = room.terminal;
        }
        
        // 如果找到了Power来源
        if(source) {
            // 计算要取多少Power
            const amount = Math.min(
                100,
                source.store[RESOURCE_POWER],
                creep.store.getFreeCapacity()
            );
            
            // 取出Power
            if(creep.withdraw(source, RESOURCE_POWER, amount) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
        // 没有找到Power来源，闲置
        else {
            this.idleBehavior(creep);
        }
    },
    
    /**
     * 将Power送到PowerSpawn
     * @param {Creep} creep - Creep对象
     */
    deliverPower: function(creep) {
        const room = creep.room;
        
        // 获取PowerSpawn
        const powerSpawn = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_POWER_SPAWN
        })[0];
        
        // 如果有PowerSpawn且PowerSpawn的power数量小于一定阈值（如50）
        if(powerSpawn && powerSpawn.store[RESOURCE_POWER] < 50) {
            // 转移Power到PowerSpawn
            if(creep.transfer(powerSpawn, RESOURCE_POWER) === ERR_NOT_IN_RANGE) {
                creep.moveTo(powerSpawn, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
        // 如果没有找到PowerSpawn或PowerSpawn已满，将Power放回Storage或Terminal
        else {
            this.returnPowerToStorage(creep);
        }
    },
    
    /**
     * 将Power放回Storage或Terminal
     * @param {Creep} creep - Creep对象
     */
    returnPowerToStorage: function(creep) {
        const room = creep.room;
        
        // 优先返回到Storage
        if(room.storage) {
            if(creep.transfer(room.storage, RESOURCE_POWER) === ERR_NOT_IN_RANGE) {
                creep.moveTo(room.storage, {visualizePathStyle: {stroke: '#ffffff'}});
            }
            creep.say('🔙 回存');
            return true;
        }
        // 其次返回到Terminal
        else if(room.terminal) {
            if(creep.transfer(room.terminal, RESOURCE_POWER) === ERR_NOT_IN_RANGE) {
                creep.moveTo(room.terminal, {visualizePathStyle: {stroke: '#ffffff'}});
            }
            creep.say('🔙 回存');
            return true;
        }
        
        return false;
    },
    
    /**
     * 闲置行为
     * @param {Creep} creep - Creep对象
     */
    idleBehavior: function(creep) {
        // 如果身上有Power并且不是暂停状态，先尝试放回Storage
        if(creep.store.getUsedCapacity(RESOURCE_POWER) > 0 && !creep.memory.powerPause) {
            if(this.returnPowerToStorage(creep)) {
                return;
            }
        }
        
        // 优先待在PowerSpawn附近
        const powerSpawn = creep.room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_POWER_SPAWN
        })[0];
        
        if(powerSpawn) {
            creep.moveTo(powerSpawn, {
                visualizePathStyle: {stroke: '#ffffff'},
                range: 2
            });
            creep.say('🕒 待命');
            return;
        }
        
        // 否则待在Storage附近
        if(creep.room.storage) {
            creep.moveTo(creep.room.storage, {
                visualizePathStyle: {stroke: '#ffffff'},
                range: 2
            });
            creep.say('🕒 待命');
            return;
        }
        
        // 最后选择待在房间中心
        creep.moveTo(new RoomPosition(25, 25, creep.room.name), {
            visualizePathStyle: {stroke: '#ffaa00'},
            range: 5
        });
        creep.say('🕒 待命');
    },
    
    /**
     * 根据游戏阶段和可用能量返回适合的身体部件
     * @param {number} energy - 可用能量
     * @param {Object} gameStage - 游戏阶段对象
     * @returns {Array} - 身体部件数组
     */
    getBody: function(energy, gameStage) {
        let body = [];
        
        // Power运输者只需要适量的CARRY和MOVE部件
        if(gameStage.level >= 6 && energy >= 800) {
            // 高级阶段配置
            body = [
                CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE
            ];
        }
        else if(gameStage.level >= 4 && energy >= 550) {
            // 中级阶段配置
            body = [
                CARRY, CARRY, CARRY, CARRY, CARRY, 
                MOVE, MOVE, MOVE, MOVE, MOVE
            ];
        }
        else {
            // 最小配置
            body = [CARRY, CARRY, MOVE, MOVE];
        }
        
        return body;
    }
};

module.exports = rolePowerHauler; 