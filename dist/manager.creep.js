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
        
        // 检查并添加入侵相关的creep目标数量
        this.addInvasionCreepCounts(room.name, targetCounts);
        
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
                // 检查是否是入侵相关的角色
                if(['claimer', 'dismantler', 'remoteMiner', 'remoteHauler'].includes(role)) {
                    this.spawnInvasionCreep(room, spawns[0], role, gameStage);
                } else {
                    this.spawnCreep(room, spawns[0], role, gameStage);
                }
                // 一次只生成一个creep
                return;
            }
        }
    },
    
    /**
     * 添加入侵相关的creep目标数量
     * @param {string} roomName - 房间名称
     * @param {Object} targetCounts - 目标数量对象
     */
    addInvasionCreepCounts: function(roomName, targetCounts) {
        // 从内存中获取特定入侵角色的目标数量
        if(Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].targetCreepCounts) {
            const invasionCounts = Memory.rooms[roomName].targetCreepCounts;
            
            // 将入侵角色的目标数量添加到总目标中
            for(const role of ['claimer', 'dismantler', 'remoteMiner', 'remoteHauler']) {
                if(invasionCounts[role]) {
                    targetCounts[role] = (targetCounts[role] || 0) + invasionCounts[role];
                }
            }
        }
    },
    
    /**
     * 生成入侵相关的creep
     * @param {Room} room - 房间对象
     * @param {StructureSpawn} spawn - spawn结构对象
     * @param {string} role - 要生成的角色名称
     * @param {Object} gameStage - 游戏阶段对象
     */
    spawnInvasionCreep: function(room, spawn, role, gameStage) {
        // 获取角色的特殊配置
        const config = Memory.creepConfigs && 
                      Memory.creepConfigs[role] && 
                      Memory.creepConfigs[role][room.name];
        
        if(!config) {
            console.log(`错误: 没有找到 ${role} 在 ${room.name} 的配置信息`);
            return;
        }
        
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
        
        // 准备内存对象
        const memory = {
            role: role,
            working: false,
            homeRoom: room.name,
            targetRoom: config.targetRoom
        };
        
        // 添加特定角色的额外内存属性
        if(role === 'claimer' && config.mode) {
            memory.mode = config.mode;
        }
        
        // 设置矿工不被对穿
        if(role === 'remoteMiner') {
            memory.dontPullMe = true;
        }

        if(role === 'dismantler') {
            memory.dontPullMe = true;
        }

        if(role === 'remoteBuilder') {
            memory.dontPullMe = true;
        }

        if(role === 'harvester') {
            memory.dontPullMe = true;
        }
        
        if (role === "terminalHauler") {
            memory.dontPullMe = true;
        }

        // 对于存储运输者设置storageHauler标记
        if(role === 'remoteHauler' && config.storageHauler) {
            memory.storageHauler = true;
        }
        
        // 尝试生成新的creep
        const result = spawn.spawnCreep(body, newName, { memory });
        
        // 如果成功生成，输出通知
        if(result === OK) {
            console.log(`${room.name} 正在生成新的 ${role}: ${newName} 目标房间: ${config.targetRoom}${memory.storageHauler ? ' [存储运输]' : ''}`);
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
        
        // 准备内存对象
        let memory = request.memory || {
            role: request.role,
            working: false,
            homeRoom: room.name
        };
        
        // 对特定角色设置dontPullMe为true，防止被对穿
        if(['miner', 'builder', 'upgrader', 'harvester', 'mineralHarvester', 'dismantler', 'remoteBuilder', "terminalHauler"].includes(request.role) && !memory.dontPullMe) {
            memory.dontPullMe = true;
        }
        
        // 尝试生成新的creep
        const result = spawn.spawnCreep(body, newName, {
            memory: memory
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
        let priorityOrder = ['hauler', 'miner', 'harvester', 'upgrader', 'defender', 'builder', 'repairer', 'wallRepairer', 'claimer', 'dismantler', 'remoteMiner', 'remoteHauler', 'transfer', 'signer', 'remoteBuilder', 'mineralHarvester', 'mineralHauler', 'terminalHauler', "labHauler"];
        
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
        
        // 终端相关检查
        if(gameStage.level >= 6 && room.terminal) {
            const hasTerminalTasks = room.memory.terminalTasks && room.memory.terminalTasks.length > 0;
            const isAutoTradingEnabled = room.memory.autoTrading && room.memory.autoTrading.enabled;
            
            // 如果有终端任务或自动交易已启用，提高终端运输者的优先级
            if(hasTerminalTasks || isAutoTradingEnabled) {
                // 移除终端运输者，并添加到优先位置
                const withoutTerminalHauler = priorityOrder.filter(r => r !== 'terminalHauler');
                const index = withoutTerminalHauler.indexOf('hauler') + 1;
                withoutTerminalHauler.splice(index, 0, 'terminalHauler');
                priorityOrder = withoutTerminalHauler;
            }
        }
        
        // 矿物处理相关检查
        if(gameStage.level >= 6) {
            // 检查房间中是否有Extractor
            const extractors = room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_EXTRACTOR
            });
            
            // 检查房间中的矿物和容器
            if(extractors.length > 0) {
                const minerals = room.find(FIND_MINERALS);
                
                if(minerals.length > 0 && minerals[0].mineralAmount > 0) {
                    const containers = minerals[0].pos.findInRange(FIND_STRUCTURES, 1, {
                        filter: s => s.structureType === STRUCTURE_CONTAINER
                    });
                    
                    if(containers.length > 0) {
                        // 提高矿物采集者和运输者的优先级
                        // 移除它们，然后添加到优先位置
                        const withoutMineral = priorityOrder.filter(r => 
                            r !== 'mineralHarvester' && r !== 'mineralHauler');
                            
                        // 在miner和hauler之后添加矿物角色
                        const index = withoutMineral.indexOf('hauler') + 1;
                        withoutMineral.splice(index, 0, 'mineralHarvester', 'mineralHauler');
                        priorityOrder = withoutMineral;
                    }
                }
            }
        }
        
        // 根据游戏阶段调整优先级
        if(gameStage.level >= 4) {
            // 高级阶段，矿工、运输者和转运者的优先级提高
            priorityOrder = ['hauler', 'miner', 'harvester', 'transfer', 'upgrader', 'builder', 'repairer', 'defender', 'wallRepairer', 'mineralHarvester', 'mineralHauler', 'terminalHauler', 'claimer', 'dismantler', 'remoteMiner', 'remoteHauler', "labHauler"];
        }
        else if(gameStage.level >= 3) {
            // 中期阶段，矿工和运输者的优先级提高
            priorityOrder = ['harvester', 'miner', 'hauler', 'upgrader', 'builder', 'repairer', 'defender', 'wallRepairer', 'claimer', 'dismantler', 'remoteMiner', 'remoteHauler', 'transfer', 'mineralHarvester', 'mineralHauler', 'terminalHauler', "labHauler"];
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
        
        // 准备内存对象，特定角色设置不对穿属性
        const memory = {
            role: role,
            working: false,
            homeRoom: room.name
        };
        
        // 对特定角色设置dontPullMe为true，防止被对穿
        if(['miner', 'builder', 'upgrader', 'harvester', 'mineralHarvester', 'dismantler', 'remoteBuilder', "terminalHauler"].includes(role)) {
            memory.dontPullMe = true;
        }
        
        // 尝试生成新的creep
        const result = spawn.spawnCreep(body, newName, {
            memory: memory
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
            
            // 为特定角色设置dontPullMe属性，防止被对穿
            if(['miner', 'builder', 'upgrader', 'harvester', 'mineralHarvester', 'dismantler', 'remoteBuilder', "terminalHauler"].includes(role) && !creep.memory.dontPullMe) {
                creep.memory.dontPullMe = true;
            }
            
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