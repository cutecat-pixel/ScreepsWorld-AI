const utils = require('utils');

/**
 * 墙壁修复者角色
 * 专门负责修复墙壁(WALL)和城墙(RAMPART)
 */
const roleWallRepairer = {
    /**
     * 获取墙壁修复者的身体部件配置
     * @param {number} energyAvailable - 可用能量
     * @param {Object} gameStage - 游戏阶段对象
     * @returns {Array} - 身体部件数组
     */
    getBody: function(energyAvailable, gameStage) {

        let body = [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
        // 高能量配置
        if(energyAvailable >= 950 && gameStage.level >= 4) {
            body = [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY,
                    MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
        }
        // 中等能量配置
        else if(energyAvailable >= 700 && gameStage.level >= 3) {
            body = [WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
        }
        
        return body;
    },
    
    /**
     * 运行墙壁修复者逻辑
     * @param {Creep} creep - Creep对象
     */
    run: function(creep) {
        // 状态切换逻辑
        utils.switchWorkState(creep, '收集', '刷墙');
        
        // 如果在工作模式（修复墙壁）
        if(creep.memory.working) {
            // 寻找需要修复的墙壁或城墙
            const target = this.findWallToRepair(creep.room);
            
            if(target) {
                // 如果找到需要修复的墙壁，前往修复
                if(creep.repair(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#66ccff'}});
                }
            } else {
                // 如果没有需要修复的墙壁，前往房间中心等待
                creep.moveTo(new RoomPosition(25, 25, creep.room.name), {
                    visualizePathStyle: {stroke: '#ffffff'},
                    range: 5
                });
            }
        }
        // 如果在采集模式（收集能量）
        else {
            // 尝试从容器或储藏获取能量
            const energySource = utils.findEnergySource(creep);
            
            if(energySource) {
                // 根据能量源类型采取不同行动
                if(energySource.structureType) {
                    // 从结构中提取能量
                    if(creep.withdraw(energySource, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(energySource, {visualizePathStyle: {stroke: '#ffaa00'}});
                    }
                } else if(energySource.resourceType) {
                    // 捡起掉落的资源
                    if(creep.pickup(energySource) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(energySource, {visualizePathStyle: {stroke: '#ffaa00'}});
                    }
                } else {
                    // 直接采集能量源（一般情况下不会走到这里，因为没有WORK部件）
                    if(creep.harvest(energySource) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(energySource, {visualizePathStyle: {stroke: '#ffaa00'}});
                    }
                }
            }
        }
    },
    
    /**
     * 寻找需要修复的墙壁或城墙
     * @param {Room} room - 房间对象
     * @returns {Structure} - 找到的需要修复的墙壁或城墙
     */
    findWallToRepair: function(room) {
        // 墙壁和城墙的目标生命值
        const targetHits = this.getTargetWallHits(room);
        
        // 寻找生命值低于目标值的墙壁和城墙
        return room.find(FIND_STRUCTURES, {
            filter: structure => 
                (structure.structureType === STRUCTURE_WALL || 
                 structure.structureType === STRUCTURE_RAMPART) && 
                structure.hits < structure.hitsMax
        }).sort((a, b) => a.hits - b.hits)[0];
    },
    
    /**
     * 根据房间控制器等级确定墙壁的目标生命值
     * @param {Room} room - 房间对象
     * @returns {number} - 目标生命值
     */
    getTargetWallHits: function(room) {
        // 根据房间控制器等级设置不同的墙壁目标生命值
        if(!room.controller) return 10000;
        
        switch(room.controller.level) {
            case 3: return 200000;
            case 4: return 500000;
            case 5: return 1000000;
            case 6: return 2000000;
            case 7: return 5000000;
            case 8: return 10000000;
            default: return 0;
        }
    }
};

module.exports = roleWallRepairer; 