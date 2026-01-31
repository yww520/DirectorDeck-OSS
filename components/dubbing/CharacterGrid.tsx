/**
 * CharacterGrid - 角色选择网格
 * 
 * 显示可选择的角色头像网格
 */

import React from 'react';
import { Users, UserCircle2 } from 'lucide-react';
import { Character } from '../../types';
import { getAvatarUrl } from './types';

interface CharacterGridProps {
    /** 角色列表 */
    characters: Character[];
    /** 当前选中的角色 ID */
    selectedCharacterId: string;
    /** 选择角色回调 */
    onSelect: (characterId: string) => void;
}

const CharacterGrid: React.FC<CharacterGridProps> = React.memo(({
    characters,
    selectedCharacterId,
    onSelect
}) => {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Users size={16} className="text-cine-accent" />
                    选择预设角色 (Standard)
                </h3>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-5">
                {characters.map(char => {
                    const avatar = getAvatarUrl(char);
                    const isSelected = selectedCharacterId === char.id;
                    return (
                        <button
                            key={char.id}
                            onClick={() => onSelect(char.id)}
                            className="flex flex-col items-center gap-2.5 transition-all duration-300 group"
                        >
                            <div className={`
                                relative w-16 h-16 rounded-[24px] border-2 flex items-center justify-center overflow-hidden transition-all
                                ${isSelected
                                    ? 'border-cine-accent bg-cine-accent/10 shadow-[0_0_20px_rgba(201,255,86,0.15)] ring-4 ring-cine-accent/5'
                                    : 'border-zinc-800/60 bg-zinc-900/50 grayscale opacity-40 hover:grayscale-0 hover:opacity-100'
                                }
                            `}>
                                {avatar ? (
                                    <img src={avatar} className="w-full h-full object-cover" alt={char.name} />
                                ) : (
                                    <UserCircle2 size={32} className="text-zinc-800" />
                                )}
                                {isSelected && <div className="absolute inset-0 bg-cine-accent/5" />}
                            </div>
                            <span className={`text-[9px] font-black truncate w-full text-center tracking-[0.15em] px-1 uppercase ${isSelected ? 'text-cine-accent' : 'text-zinc-600'}`}>
                                {char.name}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
});

CharacterGrid.displayName = 'CharacterGrid';

export default CharacterGrid;
