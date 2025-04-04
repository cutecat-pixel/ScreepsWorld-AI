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
        
        // 先检查生成队列
        if(this.processSpawnQueue(room, spawns[0], gameStage)) {
            return; // 如果已经从队列中生成了一个creep，就返回
        }
        
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
     * 处理生成队列
     * @param {Room} room - 房间对象
     * @param {StructureSpawn} spawn - spawn结构对象
     * @param {Object} gameStage - 游戏阶段对象
     * @returns {boolean} - 是否成功生成了一个creep
     */
    processSpawnQueue: function(room, spawn, gameStage) {
        // 检查该房间是否有生成队列
        if(!Memory.spawnQueue || !Memory.spawnQueue[room.name] || Memory.spawnQueue[room.name].length === 0) {
            return false;
        }
        
        // 按优先级排序队列
        Memory.spawnQueue[room.name].sort((a, b) => a.priority - b.priority);
        
        // 尝试生成队列中第一个creep
        const request = Memory.spawnQueue[room.name][0];
        
        // 获取可用能量
        const energyAvailable = room.energyAvailable;
        
        // 获取角色模块
        const roleModule = roles[request.role];
        
        if(!roleModule) {
            console.log(`无法找到角色模块: ${request.role}`);
            // 移除无效请求
            Memory.spawnQueue[room.name].shift();
            return false;
        }
        
        // 获取适合当前能量的身体部件
        const body = roleModule.getBody(energyAvailable, gameStage);
        
        // 创建唯一名称
        const newName = request.role + Game.time;
        
        // 尝试生成新的creep
        const result = spawn.spawnCreep(body, newName, {
            memory: request.memory || {
                role: request.role,
                working: false,
                homeRoom: room.name
            }
        });
        
        // 如果成功生成，输出通知并从队列中移除
        if(result === OK) {
            console.log(`${room.name} 从队列生成新的 ${request.role}: ${newName}`);
            Memory.spawnQueue[room.name].shift();
            return true;
        }
        
        // 如果能量不足，等待能量
        if(result === ERR_NOT_ENOUGH_ENERGY) {
            return true; // 返回true以阻止常规生成过程
        }
        
        // 其他错误，移除请求
        if(result !== ERR_BUSY) {
            console.log(`生成 ${request.role} 失败，错误代码: ${result}`);
            Memory.spawnQueue[room.name].shift();
        }
        
        return false;
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
            if(creep.memory.homeRoom !== room.name) continue;
            
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
        let priorityOrder = ['harvester', 'upgrader', 'builder', 'repairer', 'miner', 'hauler', 'defender', 'wallRepairer', 'claimer', 'dismantler'];
        
        // 紧急情况的优先级调整
        
        // 如果能量采集者数量为0，优先生成能量采集者
        const harvesters = _.filter(Game.creeps, creep => 
            creep.memory.role === 'harvester' && creep.memory.homeRoom === room.name);
        
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
            priorityOrder = ['harvester', 'miner', 'hauler', 'upgrader', 'builder', 'repairer', 'defender', 'wallRepairer', 'claimer', 'dismantler'];
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
     * 运行所有creep的逻辑
     */
    runCreeps: function() {
        // 遍历所有creep并执行它们的角色逻辑
        for(let name in Game.creeps) {
            const creep = Game.creeps[name];
            
            // 获取角色
            const role = creep.memory.role || 'harvester';
            
            // 尝试获取这个角色的模块
            const roleModule = roles[role];
            
            if(roleModule) {
                // 运行角色逻辑
                try {
                    roleModule.run(creep);
                } catch(error) {
                    console.log(`运行 ${role} ${name} 的逻辑时出错: ${error.stack}`);
                }
            } else {
                console.log(`未找到角色 ${role} 的模块`);
                // 默认使用harvester角色
                try {
                    roles.harvester.run(creep);
                } catch(error) {
                    console.log(`使用默认角色逻辑时出错: ${error.stack}`);
                }
            }
        }
    }
};

module.exports = creepManager; 