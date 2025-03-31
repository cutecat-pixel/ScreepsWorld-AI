/**
 * 防御塔管理器
 * 负责控制房间中的防御塔
 */
const towerManager = {
    /**
     * 管理房间内的所有塔
     * @param {Room} room - 房间对象
     */
    manageTowers: function(room) {
        // 找出所有的塔
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_TOWER
        });
        
        // 如果没有塔，直接返回
        if(towers.length === 0) return;
        
        // 为每个塔分配任务
        for(let tower of towers) {
            this.runTower(tower);
        }
    },
    
    /**
     * 运行单个塔的逻辑
     * @param {StructureTower} tower - 塔结构对象
     */
    runTower: function(tower) {
        // 检查塔的能量是否足够行动
        if(tower.store[RESOURCE_ENERGY] < 10) return;
        
        // 优先攻击敌对creep
        const hostileCreeps = tower.room.find(FIND_HOSTILE_CREEPS);
        
        if(hostileCreeps.length > 0) {
            // 标记房间正在被攻击
            if(!Memory.roomData) Memory.roomData = {};
            if(!Memory.roomData[tower.room.name]) Memory.roomData[tower.room.name] = {};
            
            Memory.roomData[tower.room.name].underAttack = true;
            Memory.roomData[tower.room.name].lastAttackTime = Game.time;
            
            // 优先攻击治疗单位或距离最近的单位
            const healers = _.filter(hostileCreeps, creep => {
                return creep.getActiveBodyparts(HEAL) > 0;
            });
            
            if(healers.length > 0) {
                // 攻击第一个治疗单位
                tower.attack(healers[0]);
            } else {
                // 攻击最近的敌人
                const closest = tower.pos.findClosestByRange(hostileCreeps);
                tower.attack(closest);
            }
            
            return;
        }
        
        // 如果没有敌人但能量超过70%，修理受损的结构
        if(tower.store[RESOURCE_ENERGY] > tower.store.getCapacity(RESOURCE_ENERGY) * 0.7) {
            this.repairStructures(tower);
        }
    },
    
    /**
     * 使用塔修理结构
     * @param {StructureTower} tower - 塔结构对象
     */
    repairStructures: function(tower) {
        // 首先修理严重受损的关键结构(低于50%生命值)
        const criticalStructures = tower.room.find(FIND_STRUCTURES, {
            filter: (s) => (s.hits < s.hitsMax * 0.5) &&
                          (s.structureType === STRUCTURE_CONTAINER ||
                           s.structureType === STRUCTURE_ROAD)
        });
        
        if(criticalStructures.length > 0) {
            // 修理生命值最低的结构
            const target = _.min(criticalStructures, 'hits');
            tower.repair(target);
            return;
        }
        
        // 其次修理受损的一般结构(低于80%生命值，不包括墙和城墙)
        const damagedStructures = tower.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (s) => s.hits < s.hitsMax * 0.8 &&
                          s.structureType !== STRUCTURE_WALL &&
                          s.structureType !== STRUCTURE_RAMPART
        });
        
        if(damagedStructures) {
            tower.repair(damagedStructures);
            return;
        }
        
        // 最后，如果能量很充足(>90%)，维护防御墙和城墙到一个基本水平
        if(tower.store[RESOURCE_ENERGY] > tower.store.getCapacity(RESOURCE_ENERGY) * 0.9) {
            let targetHits = 10000; // 默认目标生命值
            
            // 根据控制器等级调整目标生命值
            if(tower.room.controller) {
                const level = tower.room.controller.level;
                if(level >= 6) targetHits = 50000;
                else if(level >= 4) targetHits = 20000;
            }
            
            // 找出生命值低于目标值的防御结构
            const walls = tower.room.find(FIND_STRUCTURES, {
                filter: (s) => (s.structureType === STRUCTURE_WALL || 
                              s.structureType === STRUCTURE_RAMPART) &&
                              s.hits < targetHits
            });
            
            if(walls.length > 0) {
                // 修理生命值最低的墙
                const target = _.min(walls, 'hits');
                tower.repair(target);
            }
        }
    }
};

module.exports = towerManager; 