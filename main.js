// 导入各个模块
const _managers = require('_managers');
const _roles = require('_roles');

/**
 * Screeps主逻辑入口
 * 每tick会自动调用这个函数
 */
module.exports.loop = function() {
    // 清理内存
    _managers.memory.cleanupMemory();
    
    // 遍历所有房间
    for(const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        
        // 确保只针对我们控制的房间运行代码
        if(room.controller && room.controller.my) {
            // 获取当前游戏阶段
            const gameStage = _managers.gameStage.getCurrentStage();
            
            // 处理房间中的防御塔
            _managers.tower.manageTowers(room);
            
            // 管理该房间的creep生成
            _managers.creep.manageCreeps(room, gameStage);
        }
    }
    
    // 运行所有creep的逻辑
    _managers.creep.runCreeps();
    
    // 每100个tick报告一次统计信息
    if(Game.time % 100 === 0) {
        _managers.memory.reportStats();
    }
};

// 自动生成creeps
function autoSpawnCreeps(room, spawn) {
    // 统计各种角色的creep数量
    let harvesters = _.filter(Game.creeps, (creep) => creep.memory.role === 'harvester' && creep.room.name === room.name);
    let upgraders = _.filter(Game.creeps, (creep) => creep.memory.role === 'upgrader' && creep.room.name === room.name);
    let builders = _.filter(Game.creeps, (creep) => creep.memory.role === 'builder' && creep.room.name === room.name);
    let repairers = _.filter(Game.creeps, (creep) => creep.memory.role === 'repairer' && creep.room.name === room.name);
    
    // 获取房间能量容量
    const energyCapacity = room.energyCapacityAvailable;
    
    // 检查是否需要生成新的harvester
    if(harvesters.length < 2) {
        createCreep(spawn, 'harvester', energyCapacity);
        return;
    }
    
    // 检查是否需要生成新的upgrader
    if(upgraders.length < 2) {
        createCreep(spawn, 'upgrader', energyCapacity);
        return;
    }
    
    // 检查是否有建筑需要建造
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
    if(constructionSites.length > 0 && builders.length < 2) {
        createCreep(spawn, 'builder', energyCapacity);
        return;
    }
    
    // 检查是否需要生成新的repairer
    if(repairers.length < 1) {
        createCreep(spawn, 'repairer', energyCapacity);
        return;
    }
    
    // 如果资源充足，增加额外的upgrader
    if(room.energyAvailable > room.energyCapacityAvailable * 0.8 && upgraders.length < 3) {
        createCreep(spawn, 'upgrader', energyCapacity);
    }
}

// 创建一个新的creep
function createCreep(spawn, role, energyCapacity) {
    // 基于可用能量定义身体部件
    let body = [];
    
    if(energyCapacity >= 550) {
        // 标准配置 [WORK, WORK, CARRY, CARRY, MOVE, MOVE]
        body = [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
    } else if(energyCapacity >= 400) {
        // 简单配置 [WORK, CARRY, CARRY, MOVE, MOVE]
        body = [WORK, CARRY, CARRY, MOVE, MOVE];
    } else {
        // 最小配置 [WORK, CARRY, MOVE]
        body = [WORK, CARRY, MOVE];
    }
    
    // 创建唯一名称
    const newName = role + Game.time;
    
    // 尝试生成新的creep
    const result = spawn.spawnCreep(body, newName, {
        memory: {role: role, working: false}
    });
    
    // 如果成功生成，输出通知
    if(result === OK) {
        console.log('正在生成新的 ' + role + ': ' + newName);
    }
}

// 运行creep角色逻辑
function runCreepRole(creep) {
    switch(creep.memory.role) {
        case 'harvester':
            roleHarvester(creep);
            break;
        case 'upgrader':
            roleUpgrader(creep);
            break;
        case 'builder':
            roleBuilder(creep);
            break;
        case 'repairer':
            roleRepairer(creep);
            break;
        default:
            // 未知角色，默认采集资源
            roleHarvester(creep);
    }
}

// harvester角色：收集能量并传输到spawn、扩展或容器
function roleHarvester(creep) {
    // 如果creep携带的能量已满，切换到传输模式
    if(creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
    }
    // 如果creep没有能量，切换到采集模式
    if(creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.working = false;
    }
    
    // 如果在采集模式
    if(!creep.memory.working) {
        // 寻找最近的能量源
        const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if(source) {
            // 如果不在采集范围内，移动到能量源
            if(creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
    }
    // 如果在传输模式
    else {
        // 寻找需要能量的结构（spawn、扩展或塔）
        const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_EXTENSION ||
                        structure.structureType === STRUCTURE_SPAWN ||
                        structure.structureType === STRUCTURE_TOWER) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        
        if(target) {
            // 如果不在传输范围内，移动到目标
            if(creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
            }
        }
        // 如果没有需要能量的结构，寻找容器
        else {
            const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER &&
                           s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
            
            if(container) {
                if(creep.transfer(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(container, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            }
            // 如果没有容器，去升级控制器
            else {
                roleUpgrader(creep);
            }
        }
    }
}

// upgrader角色：升级房间控制器
function roleUpgrader(creep) {
    // 如果creep没有能量但处于工作模式，切换到采集模式
    if(creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.working = false;
        creep.say('🔄 采集');
    }
    // 如果creep能量已满但不在工作模式，切换到工作模式
    if(!creep.memory.working && creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
        creep.say('⚡ 升级');
    }
    
    // 如果在工作模式
    if(creep.memory.working) {
        // 尝试升级控制器
        if(creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ffffff'}});
        }
    }
    // 如果在采集模式
    else {
        // 首先检查是否有容器有能量
        const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER &&
                       s.store[RESOURCE_ENERGY] > creep.store.getFreeCapacity()
        });
        
        if(container) {
            if(creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(container, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
        // 如果没有容器，直接去能量源
        else {
            const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if(creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
    }
}

// builder角色：建造结构
function roleBuilder(creep) {
    // 如果creep没有能量但处于工作模式，切换到采集模式
    if(creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.working = false;
        creep.say('🔄 采集');
    }
    // 如果creep能量已满但不在工作模式，切换到工作模式
    if(!creep.memory.working && creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
        creep.say('🚧 建造');
    }
    
    // 如果在工作模式
    if(creep.memory.working) {
        // 寻找建筑工地
        const constructionSite = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
        if(constructionSite) {
            // 尝试建造
            if(creep.build(constructionSite) === ERR_NOT_IN_RANGE) {
                creep.moveTo(constructionSite, {visualizePathStyle: {stroke: '#ffffff'}});
            }
        }
        // 如果没有建筑工地，切换到修理模式
        else {
            roleRepairer(creep);
        }
    }
    // 如果在采集模式
    else {
        // 首先检查是否有容器有能量
        const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER &&
                       s.store[RESOURCE_ENERGY] > creep.store.getFreeCapacity()
        });
        
        if(container) {
            if(creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(container, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
        // 如果没有容器，直接去能量源
        else {
            const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if(creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
    }
}

// repairer角色：修理结构
function roleRepairer(creep) {
    // 如果creep没有能量但处于工作模式，切换到采集模式
    if(creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.working = false;
        creep.say('🔄 采集');
    }
    // 如果creep能量已满但不在工作模式，切换到工作模式
    if(!creep.memory.working && creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
        creep.say('🔧 修理');
    }
    
    // 如果在工作模式
    if(creep.memory.working) {
        // 找出需要修理的结构（生命值低于最大生命值的75%）
        const structure = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s) => s.hits < s.hitsMax * 0.75 &&
                          s.structureType !== STRUCTURE_WALL &&
                          s.structureType !== STRUCTURE_RAMPART
        });
        
        // 如果找到需要修理的结构
        if(structure) {
            // 尝试修理
            if(creep.repair(structure) === ERR_NOT_IN_RANGE) {
                creep.moveTo(structure, {visualizePathStyle: {stroke: '#ffffff'}});
            }
        }
        // 如果没有结构需要修理，修理防御墙和城墙（但优先级较低）
        else {
            const walls = creep.room.find(FIND_STRUCTURES, {
                filter: (s) => (s.structureType === STRUCTURE_WALL || 
                              s.structureType === STRUCTURE_RAMPART) &&
                              s.hits < 10000
            });
            
            // 按生命值排序，优先修理最弱的
            if(walls.length > 0) {
                const target = _.min(walls, 'hits');
                if(creep.repair(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            }
            // 如果没有墙需要修理，去做builder的工作
            else {
                roleBuilder(creep);
            }
        }
    }
    // 如果在采集模式
    else {
        // 首先检查是否有容器有能量
        const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER &&
                       s.store[RESOURCE_ENERGY] > creep.store.getFreeCapacity()
        });
        
        if(container) {
            if(creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(container, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
        // 如果没有容器，直接去能量源
        else {
            const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if(creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
    }
}

// 塔防逻辑
function runTower(tower) {
    // 优先攻击敌人
    const closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    if(closestHostile) {
        tower.attack(closestHostile);
        return;
    }
    
    // 如果没有敌人且能量超过50%，修理受损的结构
    if(tower.store[RESOURCE_ENERGY] > tower.store.getCapacity(RESOURCE_ENERGY) * 0.5) {
        // 先修理重要结构（不包括围墙和城墙）
        const criticalStructures = tower.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (s) => s.hits < s.hitsMax * 0.8 &&
                          s.structureType !== STRUCTURE_WALL &&
                          s.structureType !== STRUCTURE_RAMPART
        });
        
        if(criticalStructures) {
            tower.repair(criticalStructures);
        }
    }
}