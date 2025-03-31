/**
 * 防御者角色模块
 * 负责攻击房间内的敌对Creeps
 */
const roleDefender = {
    /**
     * Defender的主要运行逻辑
     * @param {Creep} creep - 要控制的creep对象
     */
    run: function(creep) {
        // 查找房间内的敌对creeps
        const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
        
        // 如果有敌人
        if(hostiles.length > 0) {
            // 根据威胁程度对敌人排序
            const sortedHostiles = this.sortHostilesByThreat(hostiles);
            
            // 尝试攻击威胁最大的敌人
            if(creep.attack(sortedHostiles[0]) === ERR_NOT_IN_RANGE) {
                // 移动到敌人身边
                creep.moveTo(sortedHostiles[0], {
                    visualizePathStyle: {stroke: '#ff0000'},
                    reusePath: 0 // 每tick重新计算路径，因为敌人会移动
                });
                creep.say('⚔️ 攻击!');
            }
        }
        // 没有敌人时巡逻
        else {
            this.patrolRoom(creep);
        }
    },
    
    /**
     * 根据威胁程度对敌对creeps进行排序
     * @param {Array} hostiles - 敌对creep数组
     * @returns {Array} - 排序后的敌对creep数组
     */
    sortHostilesByThreat: function(hostiles) {
        return hostiles.sort((a, b) => {
            // 检查是否有治疗部件
            const aHeal = this.countBodyParts(a, HEAL);
            const bHeal = this.countBodyParts(b, HEAL);
            
            // 优先攻击有治疗能力的敌人
            if(aHeal > 0 && bHeal === 0) return -1;
            if(aHeal === 0 && bHeal > 0) return 1;
            if(aHeal !== bHeal) return bHeal - aHeal;
            
            // 其次优先攻击有远程攻击能力的敌人
            const aRanged = this.countBodyParts(a, RANGED_ATTACK);
            const bRanged = this.countBodyParts(b, RANGED_ATTACK);
            if(aRanged > 0 && bRanged === 0) return -1;
            if(aRanged === 0 && bRanged > 0) return 1;
            if(aRanged !== bRanged) return bRanged - aRanged;
            
            // 再次优先攻击有近战攻击能力的敌人
            const aAttack = this.countBodyParts(a, ATTACK);
            const bAttack = this.countBodyParts(b, ATTACK);
            if(aAttack !== bAttack) return bAttack - aAttack;
            
            // 最后按照敌人的剩余生命排序
            return a.hits - b.hits;
        });
    },
    
    /**
     * 计算creep的指定身体部件数量
     * @param {Creep} creep - 要检查的creep
     * @param {string} partType - 身体部件类型
     * @returns {number} - 部件数量
     */
    countBodyParts: function(creep, partType) {
        return creep.body.filter(part => part.type === partType).length;
    },
    
    /**
     * 让creep在房间内巡逻
     * @param {Creep} creep - 要巡逻的creep
     */
    patrolRoom: function(creep) {
        // 如果没有巡逻位置或已经到达目标位置，获取新的巡逻位置
        if(!creep.memory.patrolPos || 
           (creep.pos.x === creep.memory.patrolPos.x && 
            creep.pos.y === creep.memory.patrolPos.y)) {
            
            // 获取房间边界内的随机位置
            const x = 10 + Math.floor(Math.random() * 30); // 避开边缘区域
            const y = 10 + Math.floor(Math.random() * 30);
            
            creep.memory.patrolPos = { x, y, roomName: creep.room.name };
        }
        
        // 移动到巡逻位置
        const patrolPos = new RoomPosition(
            creep.memory.patrolPos.x, 
            creep.memory.patrolPos.y, 
            creep.memory.patrolPos.roomName
        );
        
        creep.moveTo(patrolPos, {
            visualizePathStyle: {stroke: '#0000ff'},
            reusePath: 20 // 路径可以重用更长时间，因为只是巡逻
        });
        
        // 定期切换巡逻状态提示
        if(Game.time % 10 === 0) {
            creep.say('🛡️ 巡逻');
        }
    },
    
    /**
     * 根据游戏阶段和可用能量返回适合的身体部件
     * @param {number} energy - 可用能量
     * @param {Object} gameStage - 游戏阶段对象
     * @returns {Array} - 身体部件数组
     */
    getBody: function(energy, gameStage) {
        let body = [];
        
        // 防御者需要攻击和移动部件，以及一些强化的身体部件
        if(gameStage.level >= 4 && energy >= 900) {
            // 高级阶段配置，强化的近战防御者
            body = [TOUGH, TOUGH, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE];
        }
        else if(gameStage.level >= 3 && energy >= 550) {
            // 中级阶段配置
            body = [TOUGH, ATTACK, ATTACK, MOVE, MOVE, MOVE];
        }
        else if(energy >= 390) {
            // 基础配置
            body = [TOUGH, ATTACK, ATTACK, MOVE, MOVE];
        }
        else {
            // 最小配置
            body = [ATTACK, ATTACK, MOVE];
        }
        
        return body;
    }
};

module.exports = roleDefender; 