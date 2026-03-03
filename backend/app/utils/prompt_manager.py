import yaml
import os
from typing import Dict, Any

class PromptManager:
    _instance = None
    _prompts = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(PromptManager, cls).__new__(cls)
            cls._instance._load_prompts()
        return cls._instance
    
    def _load_prompts(self):
        # Assuming prompts.yaml is in app/config/prompts.yaml
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # Go up one level to app, then to config
        config_path = os.path.join(os.path.dirname(current_dir), 'config', 'prompts.yaml')
        
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                self._prompts = yaml.safe_load(f) or {}
        except Exception as e:
            print(f"Error loading prompts.yaml: {e}")
            self._prompts = {}

    def get_prompt(self, key: str, **kwargs) -> Dict[str, str]:
        """
        Get prompt template by key and format it with kwargs.
        Returns a dictionary with 'system' and 'user' keys.
        """
        if not self._prompts:
            self._load_prompts()
            
        prompts_section = self._prompts.get('prompts', {})
        if not prompts_section:
             # Try reloading if empty
             self._load_prompts()
             prompts_section = self._prompts.get('prompts', {})
             
        prompt_config = prompts_section.get(key)
        
        if not prompt_config:
            print(f"Prompt key '{key}' not found in configuration.")
            return {"system": "", "user": ""}
            
        system_prompt = prompt_config.get('system', "")
        user_prompt_template = prompt_config.get('user', "")
        
        try:
            # Format the user prompt with provided kwargs
            user_prompt = user_prompt_template.format(**kwargs)
        except KeyError as e:
            print(f"Missing variable for prompt '{key}': {e}")
            # Try to format partially or return template with error message
            user_prompt = f"Error: Missing variable {e}. Template: {user_prompt_template}"
        except Exception as e:
            print(f"Error formatting prompt '{key}': {e}")
            user_prompt = user_prompt_template
            
        return {
            "system": system_prompt,
            "user": user_prompt
        }

# Global instance
prompt_manager = PromptManager()
