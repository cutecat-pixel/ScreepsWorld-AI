/**
 * LINK管理器
 * 负责控制LINK之间的能量传输，尤其是从STORAGE附近的LINK到控制器附近的LINK
 */
const linkManager = {
    /**
     * 初始化LINK管理器
     * 在Memory中设置LINK的角色和位置
     * @param {Room} room - 房间对象
     */
    initLinks: function(room) {
        // 如果房间没有Memory中的links数据，创建一个
        if(!room.memory.links) {
            room.memory.links = {
                storage: null,
                controller: null,
                sources: [],
                enabled: true  // 默认启用LINK传输
            };

            // 查找房间中的所有LINK
            const links = room.find(FIND_MY_STRUCTURES, {
                filter: {structureType: STRUCTURE_LINK}
            });

            // 判断并设置LINK角色
            for(let link of links) {
                // 判断LINK是否靠近STORAGE
                const nearbyStorage = link.pos.findInRange(FIND_STRUCTURES, 3, {
                    filter: {structureType: STRUCTURE_STORAGE}
                });

                if(nearbyStorage.length > 0) {
                    room.memory.links.storage = link.id;
                    continue;
                }

                // 判断LINK是否靠近控制器
                if(link.pos.inRangeTo(room.controller.pos, 4)) {
                    room.memory.links.controller = link.id;
                    continue;
                }

                // 判断LINK是否靠近能量源
                const nearbySources = link.pos.findInRange(FIND_SOURCES, 3);
                if(nearbySources.length > 0) {
                    room.memory.links.sources.push(link.id);
                }
            }
        }
    },

    /**
     * 手动重新初始化房间的LINK配置
     * 用于LINK布局变更或需要重新设置LINK角色时
     * @param {string} roomName - 房间名称
     * @returns {string} - 初始化结果信息
     */
    manualInitLinks: function(roomName) {
        const room = Game.rooms[roomName];

        // 检查房间是否存在
        if(!room) {
            return `错误: 无法访问房间 ${roomName}`;
        }

        // 检查房间是否有控制器且属于玩家
        if(!room.controller || !room.controller.my) {
            return `错误: 房间 ${roomName} 不属于您或没有控制器`;
        }
        
        // 保存当前的启用状态(如果存在)
        const enabledState = room.memory.links ? room.memory.links.enabled : true;

        // 清除现有的links配置
        if(room.memory.links) {
            delete room.memory.links;
        }

        // 重新初始化links
        this.initLinks(room);
        
        // 恢复原先的启用状态
        if(room.memory.links) {
            room.memory.links.enabled = enabledState;
        }

        // 获取初始化后的配置信息
        const linksConfig = room.memory.links;
        let result = `房间 ${roomName} 的LINK配置已重新初始化:\n`;

        if(linksConfig.storage) {
            result += `- Storage LINK: ${linksConfig.storage}\n`;
        } else {
            result += `- 未找到Storage LINK\n`;
        }

        if(linksConfig.controller) {
            result += `- Controller LINK: ${linksConfig.controller}\n`;
        } else {
            result += `- 未找到Controller LINK\n`;
        }

        result += `- Source LINKs (${linksConfig.sources.length}): ${linksConfig.sources.join(', ')}\n`;
        result += `- LINK传输功能: ${linksConfig.enabled ? '开启' : '关闭'}`;

        return result;
    },

    /**
     * 管理房间中的LINK能量传输
     * @param {Room} room - 房间对象
     */
    manageLinks: function(room) {
        // 在函数最开始添加日志，确认函数是否被调用以及针对哪个房间
        // console.log(`[${room.name}] DEBUG: Entering manageLinks`); 

        // 检查控制器等级和是否有LINK结构
        if(room.controller.level < 5 || room.find(FIND_MY_STRUCTURES, {filter: {structureType: STRUCTURE_LINK}}).length === 0) return;

        // 确保links内存对象存在
        if(!room.memory.links) {
            this.initLinks(room);
            // 初始化后可能需要等待下一tick才能获取到正确的enabled状态，或者在initLinks中设置默认值
            // 当前initLinks已设置默认enabled:true
            return;
        }

        // --- 自动开关逻辑 --- 
        const storage = room.storage;
        if (storage) {
            const storageEnergy = storage.store[RESOURCE_ENERGY] || 0;
            const currentState = room.memory.links.enabled;
            
            // 能量高于阈值，自动开启
            if (storageEnergy > 750000 && currentState === false) {
                room.memory.links.enabled = true;
                console.log(`房间 ${room.name}: Storage能量 (${storageEnergy}) > 750k，自动开启LINK传输`);
            }
            // 能量低于阈值，自动关闭
            else if (storageEnergy < 700000 && currentState !== false) { // currentState可能为true或undefined
                room.memory.links.enabled = false;
                console.log(`房间 ${room.name}: Storage能量 (${storageEnergy}) < 700k，自动关闭LINK传输`);
            }
        }
        // --- 自动开关逻辑结束 --- 

        // 检查是否初始化过LINK (storage link必须存在)
        if(!room.memory.links.storage) {
            this.initLinks(room);
            if(!room.memory.links.storage) {
                 return; 
            }
        }
        
        const storageLinkId = room.memory.links.storage; // 先获取ID
        // console.log(`[${room.name}] DEBUG: Attempting getObjectById for storage link ID: ${storageLinkId}`); // 打印尝试的ID
        const storageLink = Game.getObjectById(storageLinkId); // 执行获取
        // console.log(`[${room.name}] DEBUG: Result of getObjectById for storage link: ${storageLink}`); // 打印获取结果
        
        // 如果没有STORAGE旁的LINK，返回
        if(!storageLink) {
            // console.log(`[${room.name}] DEBUG: Exiting because storageLink object is null/undefined.`); // 增加退出日志
            return; 
        }

        // console.log(`[${room.name}] DEBUG: Checking sources array: ${JSON.stringify(room.memory.links.sources)}`); 

        // 管理能源旁的LINK（将能量发送到STORAGE旁的LINK）- 不受enabled控制
        if(room.memory.links.sources.length > 0) {
            for(let sourceLinkId of room.memory.links.sources) {
                const sourceLink = Game.getObjectById(sourceLinkId);
                // if(sourceLink && storageLink) { // 确保两者都存在再记录
                //      console.log(`[${room.name}] DEBUG Check: Source=${sourceLinkId}, SourceEnergy=${sourceLink.store.getUsedCapacity(RESOURCE_ENERGY)}, SourceCooldown=${sourceLink.cooldown}, StorageFree=${storageLink.store.getFreeCapacity(RESOURCE_ENERGY)}`);
                // }
                
                // 原有的 if 条件
                if(sourceLink &&
                   sourceLink.store.getUsedCapacity(RESOURCE_ENERGY) >= 700 &&
                   !sourceLink.cooldown &&
                   storageLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 400) {
                    // console.log(`[${room.name}] DEBUG: Attempting transfer from ${sourceLink.id} to ${storageLink.id}`); 
                    sourceLink.transferEnergy(storageLink);
                }
            }
        }
        // 控制器LINK能量传输（受enabled控制）
        const controllerLink = Game.getObjectById(room.memory.links.controller); // 可能没有控制器LINK
        // 移动到这里获取 controllerLink
        if(controllerLink) { // 只有存在Controller Link时才执行传输
             // 如果禁用了该房间的自动传输，则不执行controller link传输 (Source link传输不受影响)
            if(room.memory.links.enabled === false) { 
                return; // 如果禁用了，后面的代码（主要是controller link传输）也不用执行了
            }
            // 如果控制器旁的LINK能量不足，且STORAGE旁的LINK能量充足，传输能量
            if(controllerLink.store.getUsedCapacity(RESOURCE_ENERGY) < 200 &&
               storageLink.store.getUsedCapacity(RESOURCE_ENERGY) >= 400 &&
               !storageLink.cooldown) {
                storageLink.transferEnergy(controllerLink);
            }
        }
    },
    
    /**
     * 切换房间的LINK自动传输功能
     * @param {string} roomName - 房间名称
     * @returns {string} - 操作结果信息
     */
    toggleLinkTransfer: function(roomName) {
        const room = Game.rooms[roomName];
        
        // 检查房间是否存在
        if(!room) {
            return `错误: 无法访问房间 ${roomName}`;
        }
        
        // 确保links对象存在
        if(!room.memory.links) {
            this.initLinks(room);
        }
        
        // 切换启用状态
        room.memory.links.enabled = !room.memory.links.enabled;
        
        return `房间 ${roomName} 的LINK自动传输功能已${room.memory.links.enabled ? '开启' : '关闭'}`;
    }
};

// 添加到全局对象，以便在控制台中使用
global.linkManager = linkManager;

module.exports = linkManager;
