import uuid
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.users import User, Role, Permission
from app.schemas.user import UserCreate, UserUpdate, RoleCreate
from app.core.security import get_password_hash

class UserRepository:
    """
    Data tier operations repository managing User, Role, and Permission structures.
    """
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_user_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        """
        Retrieves a user by their UUID primary key, preloading role and permissions.
        """
        result = await self.db.execute(
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.role).selectinload(Role.permissions))
        )
        return result.scalars().first()

    async def get_user_by_email(self, email: str) -> Optional[User]:
        """
        Retrieves a user by their email address, preloading role and permissions.
        """
        result = await self.db.execute(
            select(User)
            .where(User.email == email)
            .options(selectinload(User.role).selectinload(Role.permissions))
        )
        return result.scalars().first()

    async def list_users(self, skip: int = 0, limit: int = 100) -> List[User]:
        """
        Lists registered users in database.
        """
        result = await self.db.execute(
            select(User)
            .options(selectinload(User.role).selectinload(Role.permissions))
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def create_user(self, schema: UserCreate) -> User:
        """
        Creates a new user record with hashed credentials.
        """
        db_user = User(
            email=schema.email,
            hashed_password=get_password_hash(schema.password),
            role_id=schema.role_id,
            is_active=True
        )
        self.db.add(db_user)
        await self.db.commit()
        await self.db.refresh(db_user)
        # Fetch again to populate relationship options
        user_opt = await self.get_user_by_id(db_user.id)
        assert user_opt is not None
        return user_opt

    async def update_user(self, user: User, schema: UserUpdate) -> User:
        """
        Updates fields of an existing user.
        """
        if schema.email is not None:
            user.email = schema.email
        if schema.password is not None:
            user.hashed_password = get_password_hash(schema.password)
        if schema.role_id is not None:
            user.role_id = schema.role_id
        if schema.is_active is not None:
            user.is_active = schema.is_active

        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        
        user_opt = await self.get_user_by_id(user.id)
        assert user_opt is not None
        return user_opt

    async def delete_user(self, user: User) -> None:
        """
        Deletes a user record.
        """
        await self.db.delete(user)
        await self.db.commit()

    # --- Role and Permission Helpers ---

    async def get_role_by_id(self, role_id: uuid.UUID) -> Optional[Role]:
        """
        Fetches a role by its primary key.
        """
        result = await self.db.execute(
            select(Role).where(Role.id == role_id).options(selectinload(Role.permissions))
        )
        return result.scalars().first()

    async def get_role_by_name(self, name: str) -> Optional[Role]:
        """
        Fetches a role by name.
        """
        result = await self.db.execute(
            select(Role).where(Role.name == name).options(selectinload(Role.permissions))
        )
        return result.scalars().first()

    async def list_roles(self) -> List[Role]:
        """
        Lists all system roles.
        """
        result = await self.db.execute(select(Role).options(selectinload(Role.permissions)))
        return list(result.scalars().all())

    async def create_role(self, schema: RoleCreate) -> Role:
        """
        Creates a new role and maps its permission keys.
        """
        role = Role(name=schema.name, description=schema.description)
        if schema.permission_ids:
            perms_result = await self.db.execute(
                select(Permission).where(Permission.id.in_(schema.permission_ids))
            )
            role.permissions = list(perms_result.scalars().all())

        self.db.add(role)
        await self.db.commit()
        await self.db.refresh(role)
        return role

    async def get_permission_by_name(self, name: str) -> Optional[Permission]:
        """
        Fetches a permission by name.
        """
        result = await self.db.execute(select(Permission).where(Permission.name == name))
        return result.scalars().first()

    async def list_permissions(self) -> List[Permission]:
        """
        Lists all permission keys.
        """
        result = await self.db.execute(select(Permission))
        return list(result.scalars().all())

    async def create_permission(self, name: str, description: Optional[str] = None) -> Permission:
        """
        Creates a permission identifier.
        """
        permission = Permission(name=name, description=description)
        self.db.add(permission)
        await self.db.commit()
        await self.db.refresh(permission)
        return permission

    async def create_mock_dev_user(self) -> User:
        """
        Creates and returns a default dev administrator profile for dev environments.
        """
        # Ensure 'admin' role exists
        res = await self.db.execute(select(Role).where(Role.name == "admin").options(selectinload(Role.permissions)))
        role = res.scalars().first()
        if not role:
            role = Role(id=uuid.uuid4(), name="admin", description="Administrator Role")
            self.db.add(role)
            await self.db.commit()
            await self.db.refresh(role)

        # Check if permissions exist, map to admin
        perms = ["read:transactions", "write:transactions", "write:policies"]
        for p_name in perms:
            res_p = await self.db.execute(select(Permission).where(Permission.name == p_name))
            p = res_p.scalars().first()
            if not p:
                p = Permission(id=uuid.uuid4(), name=p_name, description=f"Allows {p_name}")
                self.db.add(p)
                await self.db.commit()
                await self.db.refresh(p)
            if p not in role.permissions:
                role.permissions.append(p)
        
        await self.db.commit()

        # Ensure dev user exists
        res_u = await self.db.execute(select(User).where(User.email == "dev@aegisai.com"))
        user = res_u.scalars().first()
        if not user:
            user = User(
                id=uuid.uuid4(),
                email="dev@aegisai.com",
                hashed_password=get_password_hash("development_bypass_password"),
                role_id=role.id,
                is_active=True
            )
            self.db.add(user)
            await self.db.commit()
            
        res_f = await self.db.execute(
            select(User)
            .where(User.id == user.id)
            .options(selectinload(User.role).selectinload(Role.permissions))
        )
        return res_f.scalars().first()

