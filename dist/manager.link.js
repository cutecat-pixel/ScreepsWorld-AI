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
                sources: []
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
     * 管理房间中的LINK能量传输
     * @param {Room} room - 房间对象
     */
    manageLinks: function(room) {
        // 检查控制器等级和是否有LINK结构
        if(room.controller.level < 5 || room.find(FIND_MY_STRUCTURES, {filter: {structureType: STRUCTURE_LINK}}).length === 0) return;

        // 确保links内存对象存在
        if(!room.memory.links) {
            this.initLinks(room);
            return;
        }

        // 检查是否初始化过LINK
        if(!room.memory.links.storage && !room.memory.links.controller) {
            this.initLinks(room);
            return;
        }
        
        // 获取STORAGE旁边的LINK和控制器旁边的LINK
        const storageLink = Game.getObjectById(room.memory.links.storage);
        const controllerLink = Game.getObjectById(room.memory.links.controller);
        
        // 如果没有这两个关键LINK，返回
        if(!storageLink || !controllerLink) return;
        
        // 如果控制器旁的LINK能量不足，且STORAGE旁的LINK能量充足，传输能量
        if(controllerLink.store.getUsedCapacity(RESOURCE_ENERGY) < 200 && 
           storageLink.store.getUsedCapacity(RESOURCE_ENERGY) >= 600 && 
           !storageLink.cooldown) {
            storageLink.transferEnergy(controllerLink);
        }
        
        // 管理能源旁的LINK（将能量发送到STORAGE旁的LINK）
        if(room.memory.links.sources.length > 0) {
            for(let sourceLinkId of room.memory.links.sources) {
                const sourceLink = Game.getObjectById(sourceLinkId);
                if(sourceLink && 
                   sourceLink.store.getUsedCapacity(RESOURCE_ENERGY) >= 700 &&
                   !sourceLink.cooldown && 
                   storageLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 400) {
                    sourceLink.transferEnergy(storageLink);
                }
            }
        }
    }
};

module.exports = linkManager; 