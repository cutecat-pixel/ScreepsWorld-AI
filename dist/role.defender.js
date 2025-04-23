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
        // 检查是否有指定的目标房间
        if(creep.memory.targetRoom && creep.room.name !== creep.memory.targetRoom) {
            // 如果不在目标房间，移动到目标房间
            const exitDir = Game.map.findExit(creep.room, creep.memory.targetRoom);
            if(exitDir === ERR_NO_PATH) {
                creep.say('❌');
                return;
            }
            
            const exit = creep.pos.findClosestByRange(exitDir);
            creep.moveTo(exit, {
                visualizePathStyle: {stroke: '#ffaa00'},
                reusePath: 50
            });
            creep.say('🏃');
            return;
        }
        
        // 查找房间内的敌对creeps
        const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
        
        // 如果有敌人
        if(hostiles.length > 0) {
            // 根据威胁程度对敌人排序
            const sortedHostiles = this.sortHostilesByThreat(hostiles);
            const target = sortedHostiles[0];
            
            // 计算与目标的距离
            const range = creep.pos.getRangeTo(target);
            
            // 检查是否有HEAL部件进行自我治疗
            if(this.countBodyParts(creep, HEAL) > 0 && creep.hits < creep.hitsMax) {
                creep.heal(creep);
            }
            
            // 检查是否有RANGED_ATTACK部件进行远程攻击
            if(this.countBodyParts(creep, RANGED_ATTACK) > 0) {
                // 在3格范围内使用远程攻击
                if(range <= 3) {
                    creep.rangedAttack(target);
                    
                    // 如果敌人在2格以内且有多个敌人聚集，使用远程群体攻击
                    if(range <= 2 && hostiles.length > 1) {
                        creep.rangedMassAttack();
                    }
                    
                    // 如果距离过近，保持距离 (仅当没有近战部件时)
                    if(range <= 1 && this.countBodyParts(creep, ATTACK) === 0) {
                        // 尝试远离敌人
                        const fleePath = PathFinder.search(creep.pos, {
                            pos: target.pos,
                            range: 3
                        }, {
                            flee: true,
                            maxRooms: 1
                        });
                        
                        if(!fleePath.incomplete && fleePath.path.length > 0) {
                            creep.move(creep.pos.getDirectionTo(fleePath.path[0]));
                            creep.say('🏹');
                            // return; // 注意：如果 flee, 可能需要 return 避免后续移动
                        } else {
                             // 如果无法flee, 但距离是1, 且只有远程, 也许应该稍微后退一步？
                             // 或者保持不动攻击
                        }
                    }
                }
            }
            
            // 如果有ATTACK部件且敌人在攻击范围内，进行近战攻击
            if(this.countBodyParts(creep, ATTACK) > 0 && range <= 1) {
                creep.attack(target);
                creep.say('⚔️');
            }
            
            // 移动逻辑 (需要根据是否有近/远程调整)
            if (creep.memory._move && creep.memory._move.dest && creep.memory._move.dest.id === target.id) {
                // 如果已经在向目标移动，不需要再次调用 moveTo
            } else if (this.countBodyParts(creep, ATTACK) > 0) {
                // 如果有近战能力，优先接近
                creep.moveTo(target, {
                    visualizePathStyle: {stroke: '#ff0000'},
                    reusePath: 0, // 追击敌人时不需要复用旧路径
                    ignoreCreeps: false // 不要忽略其他creep，避免撞车
                });
            } else if(this.countBodyParts(creep, RANGED_ATTACK) > 0) {
                // 仅有远程攻击，尝试保持在3格距离
                if(range > 3) {
                    // 离目标太远，接近
                    creep.moveTo(target, {
                        visualizePathStyle: {stroke: '#ff0000'},
                        reusePath: 0,
                        range: 3,
                        ignoreCreeps: false
                    });
                } else if (range < 3) {
                     // 距离太近，尝试后退 (flee 逻辑已在 rangedAttack 部分处理，这里可以省略或作为备用)
                     // 保持不动也可以接受，让 rangedAttack 处理
                }
            } else {
                 // 没有攻击能力？也向目标移动
                creep.moveTo(target, {
                    visualizePathStyle: {stroke: '#cccccc'},
                    reusePath: 5
                });
            }
        }
        // --- 如果没有敌对 Creep，检查 Invader Core --- 
        else {
            const invaderCore = creep.room.find(FIND_HOSTILE_STRUCTURES, {
                filter: { structureType: STRUCTURE_INVADER_CORE }
            })[0]; // 通常只有一个

            if (invaderCore) {
                creep.say('💥 Core');
                // 检查是否有 ATTACK 部件
                if (this.countBodyParts(creep, ATTACK) > 0) {
                    // 移动到 Invader Core 旁边并攻击
                    if (creep.attack(invaderCore) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(invaderCore, {
                            visualizePathStyle: { stroke: '#ff0000' },
                            reusePath: 5 // 目标固定，可以适当复用路径
                        });
                    }
                } else {
                    // 如果没有近战攻击部件，Defender 无法有效攻击 Core
                    // 可以选择待命或移动到 Core 附近标记它？
                    // 简单起见，先让它移动到 Core 附近
                    if (!creep.pos.isNearTo(invaderCore)) {
                         creep.moveTo(invaderCore, {
                             visualizePathStyle: { stroke: '#cccccc' },
                             reusePath: 5
                         });
                    }
                    creep.say('❓ATTACK?')
                }
            }
            // --- 如果没有敌人且没有 Invader Core，执行巡逻 --- 
            else {
                this.patrolRoom(creep);
            }
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
        // 如果没有巡逻位置，或已经到达目标位置，或巡逻位置不在当前房间，获取新的巡逻位置
        if(!creep.memory.patrolPos || 
           (creep.pos.x === creep.memory.patrolPos.x && 
            creep.pos.y === creep.memory.patrolPos.y) ||
           creep.memory.patrolPos.roomName !== creep.room.name) {
            
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
            creep.say('🛡️');
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
        if(gameStage.level >= 3 && energy >= 1700) {
            // 高级阶段配置，多功能防御者（远程攻击和治疗能力）
            body = [
                TOUGH, TOUGH, ATTACK,
                RANGED_ATTACK, RANGED_ATTACK, 
                RANGED_ATTACK, 
                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
                HEAL, HEAL
            ];
        }
        else if(gameStage.level >= 3 && energy >= 900) {
            // 高级阶段配置，近战+远程防御者
            body = [TOUGH, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL];
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