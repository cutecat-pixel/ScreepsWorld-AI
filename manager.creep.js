const roles = require('_roles');
const gameStageManager = require('manager.gameStage');

/**
 * Creep管理器
 * 负责管理和生成各种角色的creep
 */
const creepManager = {
    /**
     * 管理房间中的creep生成
     * @param {Room} room - 房间对象
     * @param {Object} gameStage - 当前游戏阶段对象
     */
    manageCreeps: function(room, gameStage) {
        // 获取该房间应该有的各角色creep数量
        const targetCounts = gameStageManager.getCreepCountsByRole(room, gameStage);
        
        // 统计当前各角色的creep数量
        const currentCounts = this.countCreepsByRole(room);
        
        // 获取房间内所有spawn
        const spawns = room.find(FIND_MY_SPAWNS, {
            filter: spawn => !spawn.spawning
        });
        
        // 如果没有可用的spawn，直接返回
        if(spawns.length === 0) return;
        
        // 根据优先级生成需要的creep
        const priorityOrder = this.getCreepPriorityOrder(room, gameStage);
        
        for(let role of priorityOrder) {
            const targetCount = targetCounts[role] || 0;
            const currentCount = currentCounts[role] || 0;
            
            // 如果这个角色的creep数量不足，生成新的
            if(currentCount < targetCount) {
                this.spawnCreep(room, spawns[0], role, gameStage);
                // 一次只生成一个creep
                return;
            }
        }
    },
    
    /**
     * 计算房间中各角色的creep数量
     * @param {Room} room - 房间对象
     * @returns {Object} - 包含各角色数量的对象
     */
    countCreepsByRole: function(room) {
        const creepCounts = {};
        
        // 遍历所有creep
        for(let name in Game.creeps) {
            const creep = Game.creeps[name];
            
            // 只计算指定房间的creep
            if(creep.room.name !== room.name) continue;
            
            const role = creep.memory.role || 'harvester';
            
            // 计数
            if(!creepCounts[role]) {
                creepCounts[role] = 1;
            } else {
                creepCounts[role]++;
            }
        }
        
        return creepCounts;
    },
    
    /**
     * 根据当前情况确定creep生成优先级
     * @param {Room} room - 房间对象
     * @param {Object} gameStage - 游戏阶段对象
     * @returns {Array} - 角色优先级数组
     */
    getCreepPriorityOrder: function(room, gameStage) {
        // 基本优先级顺序
        let priorityOrder = ['harvester', 'upgrader', 'builder', 'repairer', 'miner', 'hauler', 'defender'];
        
        // 紧急情况的优先级调整
        
        // 如果能量采集者数量为0，优先生成能量采集者
        const harvesters = _.filter(Game.creeps, creep => 
            creep.memory.role === 'harvester' && creep.room.name === room.name);
        
        if(harvesters.length === 0) {
            return ['harvester'].concat(priorityOrder.filter(r => r !== 'harvester'));
        }
        
        // 如果房间正在被攻击，优先生成防御者
        if(Memory.roomData && Memory.roomData[room.name] && Memory.roomData[room.name].underAttack) {
            return ['defender'].concat(priorityOrder.filter(r => r !== 'defender'));
        }
        
        // 根据游戏阶段调整优先级
        if(gameStage.level >= 3) {
            // 中期以上阶段，矿工和运输者的优先级提高
            priorityOrder = ['harvester', 'miner', 'hauler', 'upgrader', 'builder', 'repairer', 'defender'];
        }
        
        return priorityOrder;
    },
    
    /**
     * 生成指定角色的creep
     * @param {Room} room - 房间对象
     * @param {StructureSpawn} spawn - spawn结构对象
     * @param {string} role - 要生成的角色名称
     * @param {Object} gameStage - 游戏阶段对象
     */
    spawnCreep: function(room, spawn, role, gameStage) {
        // 获取可用能量
        const energyAvailable = room.energyAvailable;
        
        // 尝试获取这个角色的模块
        const roleModule = roles[role];
        
        if(!roleModule) {
            console.log(`无法找到角色模块: ${role}`);
            return;
        }
        
        // 获取适合当前能量的身体部件
        const body = roleModule.getBody(energyAvailable, gameStage);
        
        // 创建唯一名称
        const newName = role + Game.time;
        
        // 尝试生成新的creep
        const result = spawn.spawnCreep(body, newName, {
            memory: {
                role: role,
                working: false,
                homeRoom: room.name
            }
        });
        
        // 如果成功生成，输出通知
        if(result === OK) {
            console.log(`${room.name} 正在生成新的 ${role}: ${newName} [阶段: ${gameStage.name}]`);
        }
    },
    
    /**
     * 运行所有creep的行为逻辑
     */
    runCreeps: function() {
        for(let name in Game.creeps) {
            const creep = Game.creeps[name];
            const role = creep.memory.role;
            
            // 如果角色有效，运行其逻辑
            if(role && roles[role]) {
                roles[role].run(creep);
            } else {
                // 默认使用harvester逻辑
                roles.harvester.run(creep);
            }
        }
    }
};

module.exports = creepManager; 