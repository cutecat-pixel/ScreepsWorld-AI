/**
 * 游戏阶段管理器
 * 负责判断当前游戏阶段并返回相应的配置
 */

// 游戏阶段定义
const GAME_STAGES = {
    // 初始阶段：开始阶段，只有基本的采集和升级能力
    EARLY: {
        name: '早期阶段',
        level: 1,
        // 各种角色的目标数量
        creepCounts: {
            harvester: 2,
            upgrader: 2,
            builder: 1,
            repairer: 0,
            miner: 0,
            hauler: 0,
            defender: 0,
            wallRepairer: 0,
            transfer: 0
        }
    },
    
    // 发展阶段：开始建造更多基础设施
    DEVELOPING: {
        name: '发展阶段',
        level: 2,
        creepCounts: {
            harvester: 3,
            upgrader: 2,
            builder: 2,
            repairer: 1,
            miner: 0,
            hauler: 0,
            defender: 1,
            wallRepairer: 0,
            transfer: 0
        }
    },
    
    // 中期阶段：开始使用专门的矿工和运输者
    MIDGAME: {
        name: '中期阶段',
        level: 3,
        creepCounts: {
            harvester: 1,
            upgrader: 3,
            builder: 2,
            repairer: 1,
            miner: 2,
            hauler: 2,
            defender: 0,
            wallRepairer: 1,
            transfer: 0
        }
    },
    
    // 高级阶段：完整的自动化和防御系统
    ADVANCED: {
        name: '高级阶段',
        level: 4,
        creepCounts: {
            harvester: 0,
            upgrader: 3,
            builder: 2,
            repairer: 1,
            miner: 2,
            hauler: 2,
            defender: 0,
            wallRepairer: 1,
            transfer: 2
        }
    },
    
    // 后期阶段：高度优化，准备扩张
    LATE: {
        name: '后期阶段',
        level: 5,
        creepCounts: {
            harvester: 0,
            upgrader: 2,
            builder: 2,
            repairer: 1,
            miner: 3,
            hauler: 2,
            defender: 1,
            wallRepairer: 1,
            transfer: 2
        }
    }
};

/**
 * 计算指定房间的游戏阶段
 * @param {Room} room - 要计算阶段的房间对象
 * @returns {Object} 游戏阶段对象
 */
function getRoomStage(room) {
    // 初始化默认为EARLY阶段
    let roomStage = GAME_STAGES.EARLY;
    
    // 检查房间是否存在及是否被我们控制
    if(!room || !room.controller || !room.controller.my) {
        return roomStage;
    }
    
    // 基于控制器等级初步判断
    if(room.controller.level >= 7) {
        roomStage = GAME_STAGES.LATE;
    } 
    else if(room.controller.level >= 5) {
        roomStage = GAME_STAGES.ADVANCED;
    }
    else if(room.controller.level >= 3) {
        // 中期阶段判断更复杂，需要检查一些关键结构
        const containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        }).length;
        
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        }).length;
        
        if(containers >= 2 && towers >= 1) {
            roomStage = GAME_STAGES.MIDGAME;
        } else {
            roomStage = GAME_STAGES.DEVELOPING;
        }
    }
    else if(room.controller.level >= 2) {
        roomStage = GAME_STAGES.DEVELOPING;
    }
    else {
        roomStage = GAME_STAGES.EARLY;
    }
    
    // 检查该房间是否受到攻击，如果是，调整防御者需求
    if(Memory.roomData && Memory.roomData[room.name] && Memory.roomData[room.name].underAttack) {
        // 创建一个新对象以避免修改原始常量
        roomStage = Object.assign({}, roomStage);
        roomStage.creepCounts = Object.assign({}, roomStage.creepCounts);
        
        // 判断是否有塔且塔能量充足
        let needExtraDefenders = false;
        
        // 如果处于中期或以上阶段，检查塔的能量
        if(roomStage.level >= 3) {
            const towers = room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_TOWER
            });
            
            // 检查塔的能量状况
            if(towers.length === 0) {
                // 如果没有塔，需要额外的防御者
                needExtraDefenders = true;
            } else {
                // 检查所有塔的能量状况
                for(const tower of towers) {
                    if(tower.store[RESOURCE_ENERGY] < tower.store.getCapacity(RESOURCE_ENERGY) * 0.1) {
                        needExtraDefenders = true;
                        break;
                    }
                }
            }
        } else {
            // 早期阶段始终需要额外防御者
            needExtraDefenders = true;
        }
        
        if(needExtraDefenders) {
            roomStage.creepCounts.defender += 1; // 额外增加1个防御者
        }
    }
    
    return roomStage;
}

/**
 * 计算当前游戏阶段
 * @param {Room} [room] - 可选的房间对象参数，如果提供则返回该房间的阶段
 * @returns {Object} 游戏阶段对象
 */
function getCurrentStage(room) {
    // 如果提供了特定房间，返回该房间的阶段
    if(room) {
        return getRoomStage(room);
    }
    
    // 向后兼容：如果没有提供房间，返回所有房间中的最高阶段
    let currentStage = GAME_STAGES.EARLY;
    
    // 遍历所有房间
    for(let name in Game.rooms) {
        const room = Game.rooms[name];
        
        // 只检查我们控制的房间
        if(!room.controller || !room.controller.my) continue;
        
        // 获取该房间的阶段
        const roomStage = getRoomStage(room);
        
        // 如果这个房间的阶段比当前计算的高，更新当前阶段
        if(roomStage.level > currentStage.level) {
            currentStage = roomStage;
        }
    }
    
    return currentStage;
}

// 根据房间和游戏阶段获取每种角色的目标数量
function getCreepCountsByRole(room, gameStage) {
    // 检查是否是战争状态
    const isUnderAttack = Memory.roomData && 
                         Memory.roomData[room.name] && 
                         Memory.roomData[room.name].underAttack;
    
    // 创建副本以避免修改原始对象
    let targetCounts = Object.assign({}, gameStage.creepCounts);
    
    // 根据房间具体情况调整数量
    
    // 1. 检查源的数量，调整矿工数量
    if(gameStage.level >= 3) { // 只有中期以上才使用专门的矿工
        const sourceCount = room.find(FIND_SOURCES).length;
        targetCounts.miner = Math.min(sourceCount, targetCounts.miner);
    }
    
    // 2. 根据建筑工地数量调整建造者数量
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
    if(constructionSites === 0) {
        targetCounts.builder = Math.max(1, targetCounts.builder - 1);
    }
    
    // 3. 处理防御者的生成逻辑
    if(isUnderAttack) {
        // 如果房间正在被攻击
        if(room.controller.level >= 3) {
            // 如果控制器等级大于3级，检查塔的能量情况
            const towers = room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_TOWER
            });
            
            // 只有在没有足够能量的塔时才生成额外防御者
            let needExtraDefenders = false;
            
            if(towers.length === 0) {
                // 如果没有塔，需要额外防御者
                needExtraDefenders = true;
            } else {
                // 检查所有塔的能量状况
                for(const tower of towers) {
                    // 如果任何一个塔的能量低于10%，才需要额外防御者
                    if(tower.store[RESOURCE_ENERGY] < tower.store.getCapacity(RESOURCE_ENERGY) * 0.1) {
                        needExtraDefenders = true;
                        break;
                    }
                }
            }
            
            // 默认维持1个防御者，如果需要额外防御者，再增加1个
            if(needExtraDefenders) {
                targetCounts.defender += 1;
            }
        } else {
            // 低等级房间直接增加防御者
            targetCounts.defender += 1;
        }
    }
    
    return targetCounts;
}

module.exports = {
    getCurrentStage,
    getCreepCountsByRole,
    GAME_STAGES
}; 